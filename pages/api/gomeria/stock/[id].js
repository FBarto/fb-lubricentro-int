import { getSheetsClient, getRows, SPREADSHEET_ID } from '../../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { id, cantidad } = req.body;
  if (!id || !cantidad) return res.status(400).json({ error: 'id y cantidad requeridos' });

  try {
    const sheets = await getSheetsClient();
    const productos = await getRows(sheets, 'productos_gomeria');
    const headers = Object.keys(productos[0]);
    const rowIdx = productos.findIndex((p) => p.id === id);
    if (rowIdx === -1) return res.status(404).json({ error: 'Producto no encontrado' });

    const stockActual = Number(productos[rowIdx].stock) || 0;
    const nuevoStock = Math.max(0, stockActual - Number(cantidad));
    const stockColIdx = headers.indexOf('stock');
    const colLetter = String.fromCharCode(65 + stockColIdx);
    const sheetRow = rowIdx + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `productos_gomeria!${colLetter}${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[nuevoStock]] },
    });

    res.status(200).json({ success: true, stock_anterior: stockActual, stock_nuevo: nuevoStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
}
