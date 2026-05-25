import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { q, categoria } = req.query;

  try {
    const sheets = await getSheetsClient();
    let productos = await getRows(sheets, 'productos');

    productos = productos.filter((p) => p.activo !== 'false');

    if (q) {
      const query = q.toLowerCase();
      productos = productos.filter(
        (p) =>
          p.nombre?.toLowerCase().includes(query) ||
          p.codigo?.toLowerCase().includes(query)
      );
    }

    if (categoria && categoria !== 'Todos') {
      productos = productos.filter((p) => p.categoria === categoria);
    }

    res.status(200).json(productos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer productos' });
  }
}
