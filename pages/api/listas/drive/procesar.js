import { getDriveClient, descargarArchivo } from '../../../../lib/drive';
import { getSheetsClient, getRows } from '../../../../lib/sheets';
import * as XLSX from 'xlsx';
import { parsearPDF } from '../../../../lib/pdf-parser';

/**
 * POST /api/listas/drive/procesar
 * Body: { fileId, fileName, fileType, proveedor_id? }
 * Descarga el archivo de Drive, lo parsea y devuelve las filas + el perfil del proveedor si existe.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { fileId, fileName, fileType, proveedor_id } = req.body;

  if (!fileId || !fileName) {
    return res.status(400).json({ error: 'Se requieren fileId y fileName' });
  }

  try {
    // ── 1. Descargar el archivo de Drive ────────────────────────────────────
    const drive = await getDriveClient();
    const buffer = await descargarArchivo(drive, fileId);

    // ── 2. Parsear según el tipo ─────────────────────────────────────────────
    let filas = [];
    let columnas = [];
    let yCoords = [];
    let advertencia = null;

    const tipo = fileType || detectarTipo(fileName);

    if (tipo === 'pdf') {
      const resultado = await parsearPDF(buffer);
      filas = resultado.filas;
      columnas = resultado.columnas;
      yCoords = resultado.yCoords || [];
      advertencia = resultado.advertencia;
    } else {
      // Excel o CSV
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const { headers, rows } = detectarCabeceraYFilas(json);
      columnas = headers;
      filas = rows;
    }

    // ── 3. Cargar perfil del proveedor si existe ─────────────────────────────
    let perfil = null;
    let mapeo_auto = {};

    if (proveedor_id) {
      try {
        const sheets = await getSheetsClient();
        const proveedores = await getRows(sheets, 'proveedores_lubricentro');
        const prov = proveedores.find((p) => p.id === proveedor_id);
        if (prov) {
          perfil = prov;
          try { mapeo_auto = JSON.parse(prov.mapeo_columnas || '{}'); } catch { mapeo_auto = {}; }
        }
      } catch { /* La pestaña puede no existir todavía */ }
    }

    // Si no hay perfil de proveedor, intentar mapeo automático
    if (!proveedor_id || !perfil) {
      mapeo_auto = autoMapear(columnas);
    }

    return res.status(200).json({
      columnas,
      filas: filas.slice(0, 500), // máximo 500 filas
      yCoords: yCoords.slice(0, 500),
      total_filas: filas.length,
      mapeo: mapeo_auto,
      perfil,
      advertencia,
    });

  } catch (err) {
    console.error('[drive/procesar]', err);
    res.status(500).json({ error: `Error procesando archivo: ${err.message}` });
  }
}



// ─── Detectar cabecera en Excel/CSV ───────────────────────────────────────────
function detectarCabeceraYFilas(json) {
  if (!json.length) return { headers: [], rows: [] };

  const keywords = ['cod', 'desc', 'nom', 'prec', 'valor', 'art', 'prod', 'pvp', 'cost', 'precio', 'venta', 'stock', 'marca'];
  let headerRowIdx = 0;

  for (let i = 0; i < Math.min(30, json.length); i++) {
    const row = json[i];
    if (!row) continue;
    const cellsText = row.map((c) => String(c || '').trim());
    if (cellsText.filter(Boolean).length < 2) continue;

    let coincidencias = 0;
    cellsText.forEach((t) => {
      if (keywords.some((k) => t.toLowerCase().includes(k))) coincidencias++;
    });
    if (coincidencias >= 2) { headerRowIdx = i; break; }
  }

  const headers = json[headerRowIdx].map((h) => String(h || '').trim());
  const rows = json.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== '' && c != null));

  return { headers, rows };
}

// ─── Auto-mapeo de columnas ───────────────────────────────────────────────────
function autoMapear(columnas) {
  const mapeo = {};
  columnas.forEach((h, i) => {
    const hl = String(h).toLowerCase();
    if (hl.includes('cod') || hl === 'id')                                    mapeo[i] = 'codigo';
    else if (hl.includes('desc') || hl.includes('nom') || hl.includes('art')) mapeo[i] = 'nombre';
    else if (hl.includes('marc'))                                              mapeo[i] = 'marca';
    else if (hl.includes('costo') || hl.includes('cost'))                     mapeo[i] = 'precio_costo';
    else if (hl.includes('lista') || hl.includes('suger'))                    mapeo[i] = 'precio_lista';
    else if (hl.includes('venta') || hl.includes('pvp') || hl.includes('precio')) mapeo[i] = 'precio_costo';
    else if (hl.includes('stock'))                                             mapeo[i] = 'stock';
    else                                                                        mapeo[i] = 'ignorar';
  });
  return mapeo;
}

function detectarTipo(nombre) {
  const ext = (nombre || '').split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  return 'excel';
}
