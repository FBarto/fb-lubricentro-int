import { getSheetsClient, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  const { usuario } = req.query;

  if (req.method !== 'PUT') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const { nombre, password, rol } = req.body;

    const updates = {};
    if (nombre !== undefined)   updates.nombre   = nombre;
    if (password !== undefined) updates.password = password;
    if (rol !== undefined)      updates.rol      = rol;

    await updateRowWhere(sheets, 'usuarios', 'usuario', usuario, updates);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Error al actualizar usuario ${usuario}` });
  }
}
