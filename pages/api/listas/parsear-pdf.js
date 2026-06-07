import { parsearPDF } from '../../../lib/pdf-parser';

/**
 * POST /api/listas/parsear-pdf
 * Body: { base64: string } — el archivo PDF en base64
 *
 * Devuelve { columnas, filas, total_filas, advertencia? } para que el frontend pueda
 * mapear columnas como haría con un Excel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Se requiere el campo base64' });

  try {
    const buffer = Buffer.from(base64, 'base64');
    const { columnas, filas, total_filas, advertencia } = await parsearPDF(buffer);

    return res.status(200).json({
      columnas,
      filas: filas.slice(0, 500), // previsualizar máximo 500 en el frontend
      total_filas,
      advertencia,
    });
  } catch (err) {
    console.error('[parsear-pdf]', err);
    res.status(500).json({ error: `Error procesando PDF: ${err.message}` });
  }
}
