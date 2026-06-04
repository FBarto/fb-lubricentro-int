import { getSheetsClient, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();

    const {
      codigo, nombre, categoria, marca, proveedor,
      precio_costo, precio_lista, margen, precio_venta,
      stock, alerta_stock, activo,
    } = req.body;

    const updates = {};
    if (codigo      !== undefined) updates.codigo       = String(codigo);
    if (nombre      !== undefined) updates.nombre       = nombre;
    if (categoria   !== undefined) updates.categoria    = categoria;
    if (marca       !== undefined) updates.marca        = marca;
    if (proveedor   !== undefined) updates.proveedor    = proveedor;
    if (precio_costo !== undefined) {
      updates.precio_costo = String(precio_costo);
      updates.ultima_actualizacion = new Date().toLocaleDateString('es-AR');
    }
    if (precio_lista !== undefined) updates.precio_lista = String(precio_lista);
    if (margen      !== undefined) updates.margen       = String(margen);
    if (precio_venta !== undefined) updates.precio_venta = String(precio_venta);
    if (stock       !== undefined) updates.stock        = String(stock);
    if (alerta_stock !== undefined) updates.alerta_stock = String(alerta_stock);
    if (activo      !== undefined) updates.activo       = String(activo);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    await updateRowWhere(sheets, 'productos_lubricentro', 'id', id, updates);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[lubricentro/productos/[id]]', err);
    if (err.message?.includes('No se encontró')) {
      return res.status(404).json({ error: `Producto "${id}" no encontrado` });
    }
    res.status(500).json({ error: 'Error actualizando producto' });
  }
}
