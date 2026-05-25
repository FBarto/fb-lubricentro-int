import { getSheetsClient, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id } = req.query;
  const { forma_pago, cliente, marketing } = req.body;

  if (!forma_pago)
    return res.status(400).json({ error: 'forma_pago requerida' });

  try {
    const sheets = await getSheetsClient();
    const hora_cobro = new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit', minute: '2-digit'
    });

    await updateRowWhere(sheets, 'ventas', 'id', id, {
      estado: 'cobrado',
      forma_pago,
      cliente: cliente || '',
      marketing: marketing || '',
      hora_cobro,
    });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar Sheets' });
  }
}
