import { getDriveClient, descargarArchivo } from '../../../../lib/drive';
import { getSheetsClient, getRows } from '../../../../lib/sheets';
import * as XLSX from 'xlsx';

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
    let advertencia = null;

    const tipo = fileType || detectarTipo(fileName);

    if (tipo === 'pdf') {
      const resultado = await parsearPDF(buffer);
      filas = resultado.filas;
      columnas = resultado.columnas;
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

// ─── Parsear PDF ──────────────────────────────────────────────────────────────
async function parsearPDF(buffer) {
  // Importación dinámica para evitar problemas de SSR con pdf-parse
  const pdfParse = (await import('pdf-parse')).default;

  let data;
  try {
    data = await pdfParse(buffer);
  } catch {
    return { columnas: [], filas: [], advertencia: 'No se pudo leer el PDF. ¿Es un archivo escaneado?' };
  }

  const texto = data.text || '';

  // Detectar si es un PDF escaneado (poco texto para el número de páginas)
  const palabras = texto.trim().split(/\s+/).length;
  if (palabras < 50) {
    return {
      columnas: ['(sin datos)'],
      filas: [],
      advertencia: 'El PDF parece ser una imagen escaneada. No se puede extraer texto automáticamente.',
    };
  }

  // Procesar líneas: buscar filas con precios
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const filasParsadas = [];

  for (const linea of lineas) {
    // Buscar líneas que contengan al menos un número que parezca precio (> 100)
    const numeros = linea.match(/[\d.,]+/g) || [];
    const precios = numeros
      .map((n) => parseFloat(n.replace(/\./g, '').replace(',', '.')))
      .filter((n) => !isNaN(n) && n >= 100 && n < 10_000_000);

    if (precios.length === 0) continue;

    // Intentar separar código | nombre | precio
    // Formato típico: "COD123  Nombre del producto  $1.500,00"
    const partes = linea.split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);

    if (partes.length >= 2) {
      filasParsadas.push(partes);
    }
  }

  if (filasParsadas.length === 0) {
    return {
      columnas: ['Línea completa'],
      filas: lineas.filter((l) => /\d{3,}/.test(l)).map((l) => [l]),
      advertencia: 'No se detectó estructura de tabla clara. Revisá el mapeo de columnas.',
    };
  }

  // Normalizar: todas las filas al mismo ancho
  const maxCols = Math.max(...filasParsadas.map((r) => r.length));
  const columnas = Array.from({ length: maxCols }, (_, i) => `Columna ${i + 1}`);

  // Intentar detectar si la primera fila es un encabezado
  const primeraFila = filasParsadas[0];
  const esCabecera = primeraFila.every((c) => !/^\d/.test(c) && isNaN(parseFloat(c)));
  const columnasFinales = esCabecera ? primeraFila : columnas;
  const filasFinales = esCabecera ? filasParsadas.slice(1) : filasParsadas;

  return { columnas: columnasFinales, filas: filasFinales, advertencia: null };
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
