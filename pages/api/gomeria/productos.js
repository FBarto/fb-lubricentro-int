import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const productos = await getRows(sheets, 'productos_gomeria');
    const activos = productos
      .filter((p) => p.activo !== 'false')
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        icon: p.icon,
        marca: p.marca || '',
        medida: p.medida || '',
        precio: Number(p.precio) || 0,
        precio_efectivo: Number(p.precio_efectivo) || 0,
        stock: Number(p.stock) || 0,
        alerta_stock: Number(p.alerta_stock) || 1,
      }));
    res.status(200).json(activos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer productos gomería' });
  }
}
