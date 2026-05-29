import { getSheetsClient, getRows, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const { nombre, icon, marca, medida, precio, precio_efectivo, stock, alerta_stock, activo, ajuste_stock } = req.body;

    const updates = {};
    if (nombre !== undefined)          updates.nombre          = nombre;
    if (icon !== undefined)            updates.icon            = icon;
    if (marca !== undefined)           updates.marca           = marca;
    if (medida !== undefined)          updates.medida          = medida;
    if (precio !== undefined)          updates.precio          = String(precio);
    if (precio_efectivo !== undefined) updates.precio_efectivo = String(precio_efectivo);
    if (alerta_stock !== undefined)    updates.alerta_stock    = String(alerta_stock);
    if (activo !== undefined)          updates.activo          = String(activo);

    // Ajuste de stock: sumar o restar al valor actual
    if (ajuste_stock !== undefined) {
      const rows = await getRows(sheets, 'productos_gomeria');
      const prod = rows.find((p) => p.id === id);
      if (!prod) return res.status(404).json({ error: `Producto ${id} no encontrado` });
      const nuevoStock = Math.max(0, Number(prod.stock || 0) + Number(ajuste_stock));
      updates.stock = String(nuevoStock);
    } else if (stock !== undefined) {
      updates.stock = String(stock);
    }

    await updateRowWhere(sheets, 'productos_gomeria', 'id', id, updates);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Error al actualizar producto ${id}` });
  }
}
