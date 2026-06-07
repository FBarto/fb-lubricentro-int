import { getDriveClient, listarArchivosPendientes } from '../../../../lib/drive';

/**
 * GET /api/listas/drive/pendientes
 * Devuelve los archivos pendientes en la carpeta de Google Drive configurada.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const drive = await getDriveClient();
    const { archivos } = await listarArchivosPendientes(drive);
    return res.status(200).json({ archivos });
  } catch (err) {
    console.error('[drive/pendientes]', err);
    if (err.message?.includes('DRIVE_FOLDER_LISTAS_ID')) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: 'Error al consultar Drive' });
  }
}
