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

// Cache de pestañas que ya se verificó que existen (evita llamados a spreadsheets.get en cada getRows)
const knownSheets = new Set();

// Cache in-memory serverless de filas por pestaña
const rowsCache = new Map(); // sheetName -> { timestamp, rows, headers }
const CACHE_TTL_MS = 4000; // 4 segundos de caché in-memory

export function invalidateCache(sheetName) {
  if (sheetName) {
    rowsCache.delete(sheetName);
  } else {
    rowsCache.clear();
  }
}

export async function ensureSheetExists(sheets, sheetName, defaultHeaders = []) {
  if (knownSheets.has(sheetName)) return;
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
    knownSheets.add(sheetName);
  } catch (err) {
    console.error(`[sheets] Error ensuring sheet ${sheetName} exists:`, err.message);
  }
}

export async function getRows(sheets, sheetName, options = {}) {
  const { forceRefresh = false } = options;

  if (!forceRefresh && rowsCache.has(sheetName)) {
    const cached = rowsCache.get(sheetName);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.rows;
    }
  }

  if (DEFAULT_HEADERS[sheetName]) {
    await ensureSheetExists(sheets, sheetName, DEFAULT_HEADERS[sheetName]);
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const [headers, ...rows] = res.data.values || [];
  if (!headers) {
    rowsCache.set(sheetName, { timestamp: Date.now(), rows: [], headers: [] });
    return [];
  }

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

  const parsedRows = rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );

  rowsCache.set(sheetName, { timestamp: Date.now(), rows: parsedRows, headers });
  return parsedRows;
}

export async function getBatchRows(sheets, sheetNames, options = {}) {
  const { forceRefresh = false } = options;
  const result = {};
  const missingSheets = [];

  for (const name of sheetNames) {
    if (!forceRefresh && rowsCache.has(name)) {
      const cached = rowsCache.get(name);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        result[name] = cached.rows;
        continue;
      }
    }
    missingSheets.push(name);
  }

  if (missingSheets.length === 0) {
    return result;
  }

  await Promise.all(
    missingSheets.map((name) =>
      DEFAULT_HEADERS[name]
        ? ensureSheetExists(sheets, name, DEFAULT_HEADERS[name])
        : Promise.resolve()
    )
  );

  const ranges = missingSheets.map((name) => `${name}!A:Z`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });

  const valueRanges = res.data.valueRanges || [];
  for (let i = 0; i < missingSheets.length; i++) {
    const sheetName = missingSheets[i];
    const rangeData = valueRanges[i];
    const [headers, ...rows] = rangeData?.values || [];

    if (!headers) {
      rowsCache.set(sheetName, { timestamp: Date.now(), rows: [], headers: [] });
      result[sheetName] = [];
      continue;
    }

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

    const parsedRows = rows.map((row) =>
      Object.fromEntries(headers.map((h, k) => [h, row[k] ?? '']))
    );

    rowsCache.set(sheetName, { timestamp: Date.now(), rows: parsedRows, headers });
    result[sheetName] = parsedRows;
  }

  return result;
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

  invalidateCache(sheetName);
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
  const data = [];
  for (const [field, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(field);
    if (colIdx === -1) continue;
    const colLetter = String.fromCharCode(65 + colIdx);
    data.push({
      range: `${sheetName}!${colLetter}${sheetRowIdx}`,
      values: [[value]],
    });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data,
      },
    });
  }

  invalidateCache(sheetName);
}

