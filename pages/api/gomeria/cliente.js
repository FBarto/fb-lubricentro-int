import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { patente } = req.query;
  if (!patente || patente.trim().length < 2) return res.status(200).json({ found: false });

  try {
    const sheets = await getSheetsClient();
    const ventas = await getRows(sheets, 'ventas');

    const busqueda = patente.trim().toUpperCase().replace(/\s/g, '');

    const matches = ventas
      .filter((v) => {
        const p = (v.patente || '').toUpperCase().replace(/\s/g, '');
        return p && p.startsWith(busqueda);
      })
      .sort((a, b) => {
        const parseDate = (s) => {
          if (!s) return new Date(0);
          const [d, m, y] = s.split('/');
          return new Date(+y, +m - 1, +d);
        };
        return parseDate(b.fecha) - parseDate(a.fecha);
      });

    if (matches.length === 0) return res.status(200).json({ found: false });

    const last = matches[0];
    return res.status(200).json({
      found: true,
      patente: last.patente || '',
      marca: last.marca || '',
      modelo: last.modelo || '',
      cliente: last.cliente || '',
      telefono: last.telefono || '',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ found: false });
  }
}
