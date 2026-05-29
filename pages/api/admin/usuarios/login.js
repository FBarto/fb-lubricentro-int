import { getSheetsClient, getRows } from '../../../../lib/sheets';

/**
 * POST /api/admin/usuarios/login
 * Valida credenciales contra la pestaña `usuarios` del Sheet.
 * Retorna el objeto usuario (sin password) si las credenciales son correctas.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    const sheets = await getSheetsClient();
    const rows = await getRows(sheets, 'usuarios');

    const match = rows.find(
      (u) => u.usuario === usuario.trim() && u.password === password
    );

    if (!match) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Nunca devolver la contraseña al cliente
    return res.status(200).json({
      usuario: {
        usuario: match.usuario,
        nombre: match.nombre,
        rol: match.rol || 'cajero',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al validar credenciales' });
  }
}
