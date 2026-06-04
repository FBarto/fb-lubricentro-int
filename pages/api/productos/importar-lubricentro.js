/**
 * /api/productos/importar-lubricentro
 * 
 * POST: importa en masa productos al catálogo lubricentro.
 * Detecta duplicados por `codigo` o por `nombre` y actualiza precios (no duplica).
 * Calcula precio_venta automáticamente si no viene, usando el margen de la categoría.
 */

import { getSheetsClient, getRows, appendRow, updateRowWhere } from '../../../lib/sheets';
import { CATEGORIAS_DEFAULT } from '../lubricentro/config';

// Genera un id único a partir del nombre
function generarId(nombre, codigo) {
  if (codigo) return `prod_${String(codigo).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}`;
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { productos } = req.body;
  if (!Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de productos' });
  }

  try {
    const sheets = await getSheetsClient();

    // Cargar márgenes actuales de config
    let margenesCfg = [];
    try {
      const cfgRows = await getRows(sheets, 'config_lubricentro');
      margenesCfg = cfgRows;
    } catch {}

    function getMargenCategoria(categoria) {
      const cfgRow = margenesCfg.find((r) => r.categoria_id === categoria);
      if (cfgRow) return Number(cfgRow.margen);
      const def = CATEGORIAS_DEFAULT.find((c) => c.id === categoria);
      return def ? def.margen : 40;
    }

    // Cargar existentes para detectar duplicados
    const existentes = await getRows(sheets, 'productos_lubricentro');
    const fecha = new Date().toLocaleDateString('es-AR');

    const resultado = { importados: 0, actualizados: 0, errores: 0, detalles: [] };

    for (const prod of productos) {
      try {
        const {
          codigo = '',
          nombre,
          categoria = 'accesorios',
          marca = '',
          proveedor = '',
          precio_costo,
          precio_lista = '',
          precio_venta: pvManual,
          stock = 0,
          alerta_stock = 0,
        } = prod;

        if (!nombre) { resultado.errores++; continue; }

        const margen = getMargenCategoria(categoria);
        const pCosto = parseFloat(String(precio_costo).replace(',', '.')) || 0;
        const pVenta = pvManual
          ? parseFloat(String(pvManual).replace(',', '.'))
          : Math.ceil(pCosto * (1 + margen / 100));

        // Buscar duplicado por código o nombre exacto
        const existente = existentes.find(
          (e) =>
            (codigo && e.codigo === String(codigo)) ||
            e.nombre.toLowerCase() === nombre.toLowerCase()
        );

        if (existente) {
          // Actualizar precios
          await updateRowWhere(sheets, 'productos_lubricentro', 'id', existente.id, {
            precio_costo: String(pCosto),
            precio_lista: String(precio_lista),
            precio_venta: String(pVenta),
            margen: String(margen),
            ultima_actualizacion: fecha,
          });
          resultado.actualizados++;
          resultado.detalles.push({ nombre, accion: 'actualizado' });
        } else {
          // Crear nuevo
          const id = generarId(nombre, codigo);
          // Asegurar unicidad de ID
          let idFinal = id;
          let counter = 1;
          while (existentes.find((e) => e.id === idFinal)) {
            idFinal = `${id}_${counter++}`;
          }

          await appendRow(sheets, 'productos_lubricentro', [
            idFinal,
            String(codigo),
            nombre,
            categoria,
            marca,
            proveedor,
            String(pCosto),
            String(precio_lista),
            String(margen),
            String(pVenta),
            String(stock),
            String(alerta_stock),
            'true',
            fecha,
          ]);

          // Agregar al array local para evitar duplicados dentro del mismo batch
          existentes.push({ id: idFinal, codigo: String(codigo), nombre });
          resultado.importados++;
          resultado.detalles.push({ nombre, accion: 'creado' });
        }
      } catch (err) {
        resultado.errores++;
        resultado.detalles.push({ nombre: prod.nombre || '?', accion: 'error', mensaje: err.message });
      }
    }

    return res.status(200).json(resultado);
  } catch (err) {
    console.error('[importar-lubricentro]', err);
    res.status(500).json({ error: 'Error importando productos lubricentro' });
  }
}
