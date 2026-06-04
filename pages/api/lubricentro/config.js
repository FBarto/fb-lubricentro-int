import { getSheetsClient, getRows, updateRowWhere, appendRow } from '../../../lib/sheets';

// Categorías con margen por defecto (40%)
export const CATEGORIAS_DEFAULT = [
  { id: 'aceites',     label: 'Aceites de motor',              margen: 40 },
  { id: 'filtros',     label: 'Filtros (aceite/aire/comb./hab.)', margen: 40 },
  { id: 'bujias',      label: 'Bujías',                        margen: 40 },
  { id: 'frenos',      label: 'Frenos (pastillas / líquido)',   margen: 40 },
  { id: 'refrigerante', label: 'Refrigerante',                  margen: 40 },
  { id: 'aditivos',    label: 'Aditivos',                       margen: 40 },
  { id: 'accesorios',  label: 'Accesorios',                     margen: 40 },
  { id: 'escobillas',  label: 'Escobillas',                     margen: 40 },
];

// Devuelve los márgenes actuales como array {id, label, margen}
async function getMargenes(sheets) {
  let rows = [];
  try {
    rows = await getRows(sheets, 'config_lubricentro');
  } catch {
    // Si la pestaña no existe todavía, devuelve los defaults
    return CATEGORIAS_DEFAULT;
  }

  return CATEGORIAS_DEFAULT.map((cat) => {
    const row = rows.find((r) => r.categoria_id === cat.id);
    return {
      ...cat,
      margen: row ? Number(row.margen) : cat.margen,
    };
  });
}

export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // GET — devuelve lista de categorías con sus márgenes
    if (req.method === 'GET') {
      const margenes = await getMargenes(sheets);
      return res.status(200).json({ categorias: margenes });
    }

    // PUT — actualiza el margen de una o varias categorías
    // Body: { categorias: [ { id: 'aceites', margen: 38 }, ... ] }
    if (req.method === 'PUT') {
      const { categorias } = req.body;
      if (!Array.isArray(categorias) || categorias.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de categorias con {id, margen}' });
      }

      // Leer estado actual de config
      let existentes = [];
      try { existentes = await getRows(sheets, 'config_lubricentro'); } catch {}

      for (const { id, margen } of categorias) {
        const existe = existentes.find((r) => r.categoria_id === id);
        const catDef = CATEGORIAS_DEFAULT.find((c) => c.id === id);
        if (!catDef) continue;

        if (existe) {
          await updateRowWhere(sheets, 'config_lubricentro', 'categoria_id', id, {
            margen: String(margen),
          });
        } else {
          await appendRow(sheets, 'config_lubricentro', [
            id,
            catDef.label,
            String(margen),
          ]);
        }
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[lubricentro/config]', err);
    res.status(500).json({ error: 'Error en configuración de lubricentro' });
  }
}
