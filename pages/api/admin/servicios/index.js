import { getSheetsClient, getRows, appendRow, updateRowWhere } from '../../../../lib/sheets';

export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // GET — lista todos los servicios (activos e inactivos)
    if (req.method === 'GET') {
      const rows = await getRows(sheets, 'servicios_gomeria');
      return res.status(200).json(rows);
    }

    // POST — crea un servicio nuevo
    if (req.method === 'POST') {
      const { id, grupo, label, icon, precio, activo = 'true' } = req.body;

      if (!id || !label || precio === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: id, label, precio' });
      }

      // Validar formato del id (sin espacios, sin caracteres especiales)
      if (!/^[a-zA-Z0-9_]+$/.test(id)) {
        return res.status(400).json({ error: 'El id solo puede contener letras, números y guiones bajos' });
      }

      // Verificar que el id no exista ya
      const existentes = await getRows(sheets, 'servicios_gomeria');
      if (existentes.find((s) => s.id === id)) {
        return res.status(409).json({ error: `Ya existe un servicio con id="${id}"` });
      }

      await appendRow(sheets, 'servicios_gomeria', [
        id,
        grupo || 'Otros',
        label,
        icon || '🔧',
        String(precio),
        activo,
      ]);

      return res.status(201).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en admin/servicios' });
  }
}
