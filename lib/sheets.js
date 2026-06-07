import { google } from 'googleapis';

export async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const DEFAULT_HEADERS = {
  proveedores_lubricentro: [
    'id',
    'nombre',
    'margen_default',
    'categoria_default',
    'mapeo_columnas',
    'ultima_importacion',
    'productos_actualizados',
    'descuento_default',
  ],
  productos_lubricentro: [
    'id',
    'codigo',
    'nombre',
    'categoria',
    'marca',
    'proveedor_id',
    'precio_costo',
    'precio_lista',
    'margen',
    'precio_venta',
    'stock',
    'alerta_stock',
    'activo',
    'ultima_actualizacion',
  ],
};

export async function ensureSheetExists(sheets, sheetName, defaultHeaders = []) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetExists = spreadsheet.data.sheets.some(
      (s) => s.properties.title === sheetName
    );

    if (!sheetExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      if (defaultHeaders.length > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [defaultHeaders] },
        });
      }
    }
  } catch (err) {
    console.error(`[sheets] Error ensuring sheet ${sheetName} exists:`, err.message);
  }
}

export async function getRows(sheets, sheetName) {
  if (DEFAULT_HEADERS[sheetName]) {
    await ensureSheetExists(sheets, sheetName, DEFAULT_HEADERS[sheetName]);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const [headers, ...rows] = res.data.values || [];
  if (!headers) return [];

  // Auto-heal: if sheet is proveedores_lubricentro and lacks descuento_default, append it
  if (sheetName === 'proveedores_lubricentro' && !headers.includes('descuento_default')) {
    headers.push('descuento_default');
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
    } catch (err) {
      console.warn('[sheets] Could not auto-add descuento_default header:', err.message);
    }
  }

  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
}

export async function appendRow(sheets, sheetName, rowData) {
  if (DEFAULT_HEADERS[sheetName]) {
    await ensureSheetExists(sheets, sheetName, DEFAULT_HEADERS[sheetName]);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowData] },
  });
}

export async function updateRowWhere(sheets, sheetName, matchField, matchValue, updates) {
  if (DEFAULT_HEADERS[sheetName]) {
    await ensureSheetExists(sheets, sheetName, DEFAULT_HEADERS[sheetName]);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const [headers, ...rows] = res.data.values || [];
  const matchIdx = headers.indexOf(matchField);
  const rowIdx = rows.findIndex((r) => r[matchIdx] === matchValue);
  if (rowIdx === -1) throw new Error(`No se encontró ${matchField}=${matchValue}`);

  const sheetRowIdx = rowIdx + 2;
  for (const [field, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(field);
    if (colIdx === -1) continue;
    const colLetter = String.fromCharCode(65 + colIdx);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${colLetter}${sheetRowIdx}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[value]] },
    });
  }
}
