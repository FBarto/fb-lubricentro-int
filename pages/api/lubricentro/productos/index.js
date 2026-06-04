import { getSheetsClient, getRows, appendRow } from '../../../../lib/sheets';

// Categorías válidas del lubricentro
export const CATEGORIAS_LUBRICENTRO = [
  'aceites',
  'filtros',
  'bujias',
  'frenos',
  'refrigerante',
  'aditivos',
  'accesorios',
  'escobillas',
];

export default async function handler(req, res) {
  try {
    const sheets = await getSheetsClient();

    // GET — lista productos con filtros opcionales
    if (req.method === 'GET') {
      const { categoria, marca, proveedor, activo } = req.query;
      let rows = await getRows(sheets, 'productos_lubricentro');

      if (categoria) rows = rows.filter((r) => r.categoria === categoria);
      if (marca) rows = rows.filter((r) => r.marca?.toLowerCase().includes(marca.toLowerCase()));
      if (proveedor) rows = rows.filter((r) => r.proveedor === proveedor);
      if (activo !== undefined) rows = rows.filter((r) => r.activo === activo);

      return res.status(200).json(rows);
    }

    // POST — crea un producto nuevo
    if (req.method === 'POST') {
      const {
        id, codigo = '', nombre, categoria, marca = '', proveedor = '',
        precio_costo, precio_lista = '', margen, precio_venta,
        stock = 0, alerta_stock = 0, activo = 'true',
      } = req.body;

      if (!id || !nombre || !categoria || precio_costo === undefined || precio_venta === undefined) {
        return res.status(400).json({
          error: 'Faltan campos obligatorios: id, nombre, categoria, precio_costo, precio_venta',
        });
      }

      if (!/^[a-zA-Z0-9_]+$/.test(id)) {
        return res.status(400).json({ error: 'El id solo puede tener letras, números y guiones bajos' });
      }

      const existentes = await getRows(sheets, 'productos_lubricentro');
      if (existentes.find((p) => p.id === id)) {
        return res.status(409).json({ error: `Ya existe un producto con id="${id}"` });
      }

      const fecha = new Date().toLocaleDateString('es-AR');

      await appendRow(sheets, 'productos_lubricentro', [
        id,
        codigo,
        nombre,
        categoria,
        marca,
        proveedor,
        String(precio_costo),
        String(precio_lista),
        String(margen ?? ''),
        String(precio_venta),
        String(stock),
        String(alerta_stock),
        activo,
        fecha,
      ]);

      return res.status(201).json({ ok: true });
    }

    return res.status(405).end();
  } catch (err) {
    console.error('[lubricentro/productos]', err);
    res.status(500).json({ error: 'Error en lubricentro/productos' });
  }
}
