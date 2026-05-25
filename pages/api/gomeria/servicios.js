import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const servicios = await getRows(sheets, 'servicios_gomeria');
    const activos = servicios
      .filter((s) => s.activo !== 'false')
      .map((s) => ({
        id: s.id,
        grupo: s.grupo,
        label: s.label,
        icon: s.icon,
        precio: Number(s.precio),
        activo: s.activo,
      }));
    res.status(200).json(activos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer servicios' });
  }
}
