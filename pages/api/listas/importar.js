import { getSheetsClient, getRows, appendRow, updateRowWhere } from '../../../lib/sheets';
import { getDriveClient, moverAProcesados } from '../../../lib/drive';

/**
 * POST /api/listas/importar
 *
 * Body:
 * {
 *   productos: [{ codigo, nombre, precio_costo, precio_lista?, marca?, categoria? }],
 *   proveedor_id: string,
 *   margen: number,          // % a aplicar sobre precio_costo para calcular precio_venta
 *   modo: 'solo_precios' | 'crear_tambien',
 *   file_id?: string,        // ID de Drive para mover a "Procesados" al terminar
 *   guardar_mapeo?: boolean, // si true, guarda el mapeo en el perfil del proveedor
 *   mapeo_columnas?: object, // mapeo a guardar (si guardar_mapeo=true)
 * }
 *
 * Respuesta:
 * { actualizados, creados, sin_cambio, omitidos, errores, detalles[] }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    productos = [],
    proveedor_id,
    margen = 40,
    modo = 'solo_precios',
    file_id,
    guardar_mapeo = false,
    mapeo_columnas,
  } = req.body;

  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de productos no vacío' });
  }

  try {
    const sheets = await getSheetsClient();

    // ── 1. Cargar catálogo actual ─────────────────────────────────────────────
    let catalogo = [];
    try { catalogo = await getRows(sheets, 'productos_lubricentro'); } catch {}

    // ── 2. Procesar cada producto ─────────────────────────────────────────────
    const resumen = { actualizados: 0, creados: 0, sin_cambio: 0, omitidos: 0, errores: 0, detalles: [] };
    const hoy = new Date().toLocaleDateString('es-AR');
    const margenNum = Number(margen) || 40;

    for (const prod of productos) {
      try {
        const precioCosto = parseFloat(String(prod.precio_costo || '0').replace(',', '.'));
        if (!prod.nombre || isNaN(precioCosto) || precioCosto <= 0) {
          resumen.omitidos++;
          continue;
        }

        const precioVenta = Math.ceil(precioCosto * (1 + margenNum / 100));

        // Buscar en catálogo: primero por código exacto, luego por nombre similar
        const match = buscarEnCatalogo(catalogo, prod);

        if (match) {
          // Producto existente — actualizar precio
          const costoAnterior = parseFloat(match.precio_costo || '0');

          if (Math.abs(costoAnterior - precioCosto) < 0.01) {
            // Sin cambio
            resumen.sin_cambio++;
            resumen.detalles.push({ nombre: prod.nombre, estado: 'sin_cambio', precio_costo: precioCosto });
          } else {
            await updateRowWhere(sheets, 'productos_lubricentro', 'id', match.id, {
              precio_costo: String(precioCosto),
              precio_lista: prod.precio_lista ? String(prod.precio_lista) : match.precio_lista,
              precio_venta: String(precioVenta),
              margen: String(margenNum),
              ultima_actualizacion: hoy,
            });
            resumen.actualizados++;
            resumen.detalles.push({
              nombre: prod.nombre,
              estado: 'actualizado',
              anterior: costoAnterior,
              nuevo: precioCosto,
              precio_venta: precioVenta,
            });
          }
        } else if (modo === 'crear_tambien') {
          // Producto nuevo — crear
          const id = generarId(prod.nombre, prod.codigo);
          const idFinal = await asegurarIdUnico(catalogo, id);

          await appendRow(sheets, 'productos_lubricentro', [
            idFinal,
            prod.codigo || '',
            prod.nombre,
            prod.categoria || 'accesorios',
            prod.marca || '',
            proveedor_id || '',
            String(precioCosto),
            prod.precio_lista ? String(prod.precio_lista) : '',
            String(margenNum),
            String(precioVenta),
            '0',  // stock
            '2',  // alerta_stock
            'true',
            hoy,
          ]);

          // Agregar al catálogo en memoria para detectar duplicados dentro del mismo lote
          catalogo.push({ id: idFinal, nombre: prod.nombre, codigo: prod.codigo || '' });

          resumen.creados++;
          resumen.detalles.push({ nombre: prod.nombre, estado: 'creado', precio_costo: precioCosto, precio_venta: precioVenta });
        } else {
          // modo solo_precios: omitir si no existe
          resumen.omitidos++;
          resumen.detalles.push({ nombre: prod.nombre, estado: 'omitido', motivo: 'No existe en catálogo' });
        }
      } catch (err) {
        resumen.errores++;
        resumen.detalles.push({ nombre: prod.nombre, estado: 'error', motivo: err.message });
      }
    }

    // ── 3. Actualizar perfil del proveedor ────────────────────────────────────
    if (proveedor_id) {
      try {
        const updates = {
          ultima_importacion: hoy,
          productos_actualizados: String(resumen.actualizados + resumen.creados),
        };
        if (guardar_mapeo && mapeo_columnas) {
          updates.mapeo_columnas = typeof mapeo_columnas === 'string'
            ? mapeo_columnas
            : JSON.stringify(mapeo_columnas);
        }
        await updateRowWhere(sheets, 'proveedores_lubricentro', 'id', proveedor_id, updates);
      } catch { /* El proveedor puede no existir todavía */ }
    }

    // ── 4. Mover archivo Drive a "Procesados" ─────────────────────────────────
    if (file_id) {
      try {
        const drive = await getDriveClient();
        const folderId = process.env.DRIVE_FOLDER_LISTAS_ID;
        if (folderId) await moverAProcesados(drive, file_id, folderId);
      } catch (err) {
        console.warn('[importar] No se pudo mover a Procesados:', err.message);
        // No fallar la importación por esto
      }
    }

    return res.status(200).json(resumen);

  } catch (err) {
    console.error('[listas/importar]', err);
    res.status(500).json({ error: `Error en importación: ${err.message}` });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buscarEnCatalogo(catalogo, prod) {
  // 1. Match exacto por código (si hay código en ambos lados)
  if (prod.codigo) {
    const byCode = catalogo.find((c) => c.codigo && c.codigo.toLowerCase() === String(prod.codigo).toLowerCase());
    if (byCode) return byCode;
  }

  // 2. Match por nombre (normalizado, sin tildes, minúsculas)
  const nombreNorm = normalizar(prod.nombre);
  const byName = catalogo.find((c) => normalizar(c.nombre) === nombreNorm);
  if (byName) return byName;

  // 3. Match parcial: el nombre del catálogo contiene el nombre del archivo (o viceversa)
  // Solo si el string es > 8 chars para evitar falsos positivos
  if (nombreNorm.length > 8) {
    const partial = catalogo.find((c) => {
      const cn = normalizar(c.nombre);
      return cn.includes(nombreNorm) || nombreNorm.includes(cn);
    });
    if (partial) return partial;
  }

  return null;
}

function normalizar(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generarId(nombre, codigo) {
  const base = codigo
    ? String(codigo).toLowerCase().replace(/[^a-z0-9]+/g, '_')
    : normalizar(nombre).replace(/ /g, '_').slice(0, 40);
  return base.replace(/^_+|_+$/g, '') || 'prod';
}

async function asegurarIdUnico(catalogo, id) {
  const existentes = new Set(catalogo.map((c) => c.id));
  if (!existentes.has(id)) return id;
  let i = 2;
  while (existentes.has(`${id}_${i}`)) i++;
  return `${id}_${i}`;
}
