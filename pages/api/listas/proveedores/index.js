import { getSheetsClient, getRows, appendRow, updateRowWhere } from '../../../../lib/sheets';

/**
 * GET  /api/listas/proveedores  — lista todos los perfiles
 * POST /api/listas/proveedores  — crea un nuevo perfil
 */
export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // ── GET ───────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      let rows = [];
      try {
        rows = await getRows(sheets, 'proveedores_lubricentro');
      } catch {
        // La pestaña puede no existir todavía; devolver array vacío
      }
      return res.status(200).json(rows);
    }

    // ── POST ──────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        id, nombre, margen_default = '40',
        categoria_default = 'accesorios',
        descuento_default = '0',
        mapeo_columnas = '{}',
      } = req.body;

      if (!id || !nombre) {
        return res.status(400).json({ error: 'Se requieren id y nombre' });
      }
      if (!/^[a-z0-9_]+$/.test(id)) {
        return res.status(400).json({ error: 'El id solo puede tener letras minúsculas, números y guiones bajos' });
      }

      // Verificar que no exista ya
      let existentes = [];
      try { existentes = await getRows(sheets, 'proveedores_lubricentro'); } catch {}
      if (existentes.find((p) => p.id === id)) {
        return res.status(409).json({ error: `Ya existe un proveedor con id="${id}"` });
      }

      await appendRow(sheets, 'proveedores_lubricentro', [
        id,
        nombre,
        String(margen_default),
        categoria_default,
        typeof mapeo_columnas === 'string' ? mapeo_columnas : JSON.stringify(mapeo_columnas),
        '',  // ultima_importacion
        '0', // productos_actualizados
        String(descuento_default), // descuento_default
      ]);

      return res.status(201).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[listas/proveedores]', err);
    res.status(500).json({ error: 'Error en proveedores' });
  }
}
