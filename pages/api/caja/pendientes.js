import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const ventas = await getRows(sheets, 'ventas');
    const items = await getRows(sheets, 'venta_items');

    const pendientes = ventas
      .filter((v) => v.estado === 'pendiente')
      .map((v) => ({
        ...v,
        items: items.filter((i) => i.venta_id === v.id).map((i) => ({
          nombre: i.nombre_item,
          cantidad: Number(i.cantidad),
          precio: Number(i.precio_unitario),
        })),
      }));

    res.status(200).json(pendientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer Sheets' });
  }
}
