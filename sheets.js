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

export async function getRows(sheets, sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const [headers, ...rows] = res.data.values || [];
  if (!headers) return [];
  return rows.map((row) =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
}

export async function appendRow(sheets, sheetName, rowData) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowData] },
  });
}

export async function updateRowWhere(sheets, sheetName, matchField, matchValue, updates) {
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
