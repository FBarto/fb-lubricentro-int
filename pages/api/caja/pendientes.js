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
        id: v.id,
        fecha: v.fecha,
        hora: v.hora,
        origen: v.origen,
        estado: v.estado,
        cliente: v.cliente || '',
        marketing: v.marketing || '',
        total: Number(v.total) || 0,
        patente: v.patente || '',
        marca: v.marca || '',
        modelo: v.modelo || '',
        telefono: v.telefono || '',
        vehiculo: v.vehiculo || '',
        items: items
          .filter((i) => i.venta_id === v.id)
          .map((i) => ({
            nombre: i.nombre_item || i.nombre || 'Servicio',
            cantidad: Number(i.cantidad) || 1,
            precio: Number(i.precio_unitario) || 0,
          })),
      }));

    res.status(200).json(pendientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer Sheets' });
  }
}
