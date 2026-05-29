import { getSheetsClient, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const { grupo, label, icon, precio, activo } = req.body;

    const updates = {};
    if (grupo !== undefined)  updates.grupo  = grupo;
    if (label !== undefined)  updates.label  = label;
    if (icon !== undefined)   updates.icon   = icon;
    if (precio !== undefined) updates.precio = String(precio);
    if (activo !== undefined) updates.activo = String(activo);

    await updateRowWhere(sheets, 'servicios_gomeria', 'id', id, updates);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Error al actualizar servicio ${id}` });
  }
}
