import { getSheetsClient, getRows, appendRow, SPREADSHEET_ID } from '../../../lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { productos } = req.body;
  if (!productos?.length) return res.status(400).json({ error: 'Sin productos' });

  try {
    const sheets = await getSheetsClient();

    // Leer productos existentes para evitar duplicados por código
    const existentes = await getRows(sheets, 'productos');
    const codigosExistentes = new Set(existentes.map((p) => p.codigo?.toLowerCase()).filter(Boolean));

    let importados = 0;
    let omitidos = 0;

    for (const prod of productos) {
      // Si tiene código y ya existe, actualizar precio
      if (prod.codigo && codigosExistentes.has(prod.codigo.toLowerCase())) {
        // Buscar fila y actualizar precio
        const rowIdx = existentes.findIndex((p) => p.codigo?.toLowerCase() === prod.codigo.toLowerCase());
        if (rowIdx !== -1) {
          const sheetRow = rowIdx + 2; // +1 header, +1 base 1
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `productos!E${sheetRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[prod.precio]] },
          });
          omitidos++;
        }
        continue;
      }

      // Producto nuevo — insertar
      await appendRow(sheets, 'productos', [
        uuidv4(),
        prod.codigo || '',
        prod.nombre,
        prod.categoria || '',
        prod.precio,
        'true',
      ]);
      importados++;
    }

    res.status(200).json({ success: true, importados, actualizados: omitidos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al importar productos' });
  }
}
