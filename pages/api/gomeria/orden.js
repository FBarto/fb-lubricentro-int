import { getSheetsClient, appendRow } from '../../../lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { items, cliente_nombre } = req.body;
  if (!items || items.length === 0)
    return res.status(400).json({ error: 'items requeridos' });

  try {
    const sheets = await getSheetsClient();
    const ventaId = uuidv4();
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-AR');
    const hora = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    await appendRow(sheets, 'ventas', [
      ventaId, fecha, hora, 'gomeria', 'pendiente',
      '', cliente_nombre || '', '', total, ''
    ]);

    for (const item of items) {
      await appendRow(sheets, 'venta_items', [
        uuidv4(), ventaId, item.nombre, item.cantidad, item.precio
      ]);
    }

    res.status(200).json({ success: true, ventaId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar en Sheets' });
  }
}
