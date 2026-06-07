import { google } from 'googleapis';

// ─── Autenticación Drive (mismo Service Account que Sheets) ───────────────────
async function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

export async function getDriveClient() {
  const auth = await getAuth();
  return google.drive({ version: 'v3', auth });
}

// ─── Listar archivos pendientes en la carpeta de listas ───────────────────────
// Excluye subcarpetas y archivos ya en "Procesados"
export async function listarArchivosPendientes(drive) {
  const folderId = process.env.DRIVE_FOLDER_LISTAS_ID;
  if (!folderId) throw new Error('DRIVE_FOLDER_LISTAS_ID no configurado en variables de entorno');

  // Buscar o crear subcarpeta "Procesados"
  const procesadosId = await obtenerCarpetaProcesados(drive, folderId);

  // Listar archivos directamente en la carpeta raíz (no subcarpetas)
  const res = await drive.files.list({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)',
    orderBy: 'modifiedTime desc',
  });

  const archivos = (res.data.files || []).map((f) => ({
    id: f.id,
    nombre: f.name,
    tipo: detectarTipoArchivo(f.name, f.mimeType),
    mimeType: f.mimeType,
    tamaño: Number(f.size || 0),
    fecha: f.modifiedTime,
  })).filter((f) => ['excel', 'csv', 'pdf'].includes(f.tipo)); // solo formatos soportados

  return { archivos, procesadosId };
}

// ─── Descargar archivo como Buffer ────────────────────────────────────────────
export async function descargarArchivo(drive, fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

// ─── Mover archivo a subcarpeta "Procesados" ──────────────────────────────────
export async function moverAProcesados(drive, fileId, folderId) {
  const procesadosId = await obtenerCarpetaProcesados(drive, folderId);

  // Obtener padres actuales
  const file = await drive.files.get({ fileId, fields: 'parents' });
  const currentParents = (file.data.parents || []).join(',');

  await drive.files.update({
    fileId,
    addParents: procesadosId,
    removeParents: currentParents,
    fields: 'id, parents',
  });

  return procesadosId;
}

// ─── Helper: obtener o crear subcarpeta "Procesados" ─────────────────────────
async function obtenerCarpetaProcesados(drive, parentId) {
  // Buscar si ya existe
  const res = await drive.files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = 'Procesados' and trashed = false`,
    fields: 'files(id)',
  });

  if (res.data.files?.length > 0) {
    return res.data.files[0].id;
  }

  // Crear la subcarpeta si no existe
  const created = await drive.files.create({
    requestBody: {
      name: 'Procesados',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return created.data.id;
}

// ─── Helper: detectar tipo por extensión ─────────────────────────────────────
function detectarTipoArchivo(nombre, mimeType) {
  const ext = (nombre || '').split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) return 'excel';
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (mimeType === 'text/csv') return 'csv';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'excel';
  return 'desconocido';
}
