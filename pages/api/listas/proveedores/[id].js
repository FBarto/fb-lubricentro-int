import { getSheetsClient, getRows, updateRowWhere } from '../../../../lib/sheets';

/**
 * PUT    /api/listas/proveedores/[id]  — edita un perfil de proveedor
 * DELETE /api/listas/proveedores/[id]  — elimina un perfil (marca como inactivo)
 */
export default async function handler(req, res) {
  const { id } = req.query;

  try {
    const sheets = await getSheetsClient();

    // ── PUT ───────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { nombre, margen_default, categoria_default, descuento_default, mapeo_columnas } = req.body;

      const updates = {};
      if (nombre !== undefined)            updates.nombre = nombre;
      if (margen_default !== undefined)    updates.margen_default = String(margen_default);
      if (categoria_default !== undefined) updates.categoria_default = categoria_default;
      if (descuento_default !== undefined) updates.descuento_default = String(descuento_default);
      if (mapeo_columnas !== undefined) {
        updates.mapeo_columnas = typeof mapeo_columnas === 'string'
          ? mapeo_columnas
          : JSON.stringify(mapeo_columnas);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      await updateRowWhere(sheets, 'proveedores_lubricentro', 'id', id, updates);
      return res.status(200).json({ ok: true });
    }

    // ── DELETE — marcar con nombre vacío para "ocultar" (Sheets no tiene DELETE real) ──
    if (req.method === 'DELETE') {
      // Verificar que existe
      let rows = [];
      try { rows = await getRows(sheets, 'proveedores_lubricentro'); } catch {}
      if (!rows.find((p) => p.id === id)) {
        return res.status(404).json({ error: `Proveedor "${id}" no encontrado` });
      }

      await updateRowWhere(sheets, 'proveedores_lubricentro', 'id', id, {
        nombre: `[ELIMINADO] ${id}`,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[listas/proveedores/[id]]', err);
    if (err.message?.includes('No se encontró')) {
      return res.status(404).json({ error: `Proveedor "${id}" no encontrado` });
    }
    res.status(500).json({ error: 'Error actualizando proveedor' });
  }
}
