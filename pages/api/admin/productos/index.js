import { getSheetsClient, getRows, appendRow } from '../../../../lib/sheets';

export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // GET — lista todos los productos (activos e inactivos)
    if (req.method === 'GET') {
      const rows = await getRows(sheets, 'productos_gomeria');
      return res.status(200).json(rows);
    }

    // POST — crea un producto nuevo
    if (req.method === 'POST') {
      const {
        id, nombre, icon, marca, medida,
        precio, precio_efectivo, stock, alerta_stock, activo = 'true',
      } = req.body;

      if (!id || !nombre || precio === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: id, nombre, precio' });
      }

      // Validar formato del id
      if (!/^[a-zA-Z0-9_]+$/.test(id)) {
        return res.status(400).json({ error: 'El id solo puede contener letras, números y guiones bajos' });
      }

      // Verificar unicidad del id
      const existentes = await getRows(sheets, 'productos_gomeria');
      if (existentes.find((p) => p.id === id)) {
        return res.status(409).json({ error: `Ya existe un producto con id="${id}"` });
      }

      await appendRow(sheets, 'productos_gomeria', [
        id,
        nombre,
        icon || '📦',
        marca || '',
        medida || '',
        String(precio),
        String(precio_efectivo || precio),
        String(stock || 0),
        String(alerta_stock || 0),
        activo,
      ]);

      return res.status(201).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en admin/productos' });
  }
}
