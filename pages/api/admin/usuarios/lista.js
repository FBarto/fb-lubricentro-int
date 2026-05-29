import { getSheetsClient, getRows } from '../../../../lib/sheets';

/**
 * GET /api/admin/usuarios/lista
 * Devuelve la lista de usuarios para mostrar en la pantalla de login.
 * Solo incluye `usuario` y `nombre` — nunca contraseñas ni roles.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const rows = await getRows(sheets, 'usuarios');
    const lista = rows.map(({ usuario, nombre }) => ({ usuario, nombre }));
    return res.status(200).json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener lista de usuarios' });
  }
}
