import { getSheetsClient, getRows, appendRow } from '../../../../lib/sheets';

export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // GET — lista usuarios SIN contraseña
    if (req.method === 'GET') {
      const rows = await getRows(sheets, 'usuarios');
      const sinPassword = rows.map(({ usuario, nombre, rol }) => ({ usuario, nombre, rol }));
      return res.status(200).json(sinPassword);
    }

    // POST — crea un usuario nuevo
    if (req.method === 'POST') {
      const { usuario, password, nombre, rol = 'cajero' } = req.body;

      if (!usuario || !password || !nombre) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: usuario, password, nombre' });
      }

      const existentes = await getRows(sheets, 'usuarios');
      if (existentes.find((u) => u.usuario === usuario.trim())) {
        return res.status(409).json({ error: `Ya existe el usuario "${usuario}"` });
      }

      await appendRow(sheets, 'usuarios', [usuario.trim(), password, nombre, rol]);
      return res.status(201).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en admin/usuarios' });
  }
}
