/**
 * POST /api/listas/parsear-pdf
 * Body: { base64: string } — el archivo PDF en base64
 *
 * Devuelve { columnas, filas, advertencia? } para que el frontend pueda
 * mapear columnas como haría con un Excel.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Se requiere el campo base64' });

  try {
    const buffer = Buffer.from(base64, 'base64');

    // Importación dinámica para compatibilidad con Next.js (pdf-parse usa require interno)
    const pdfParse = (await import('pdf-parse')).default;

    let data;
    try {
      data = await pdfParse(buffer);
    } catch {
      return res.status(200).json({
        columnas: [],
        filas: [],
        advertencia: 'No se pudo leer el PDF. Verificá que no esté dañado o protegido.',
      });
    }

    const texto = data.text || '';
    const palabras = texto.trim().split(/\s+/).length;

    // PDF escaneado (imagen)
    if (palabras < 30) {
      return res.status(200).json({
        columnas: [],
        filas: [],
        advertencia: 'El PDF parece ser una imagen escaneada. No se puede extraer el texto automáticamente. Usá el Excel o CSV del mismo proveedor.',
      });
    }

    const { columnas, filas, advertencia } = parsearTextoPDF(texto);

    return res.status(200).json({ columnas, filas: filas.slice(0, 500), total_filas: filas.length, advertencia });

  } catch (err) {
    console.error('[parsear-pdf]', err);
    res.status(500).json({ error: `Error procesando PDF: ${err.message}` });
  }
}

// ─── Parsear texto extraído del PDF ──────────────────────────────────────────
function parsearTextoPDF(texto) {
  const lineas = texto.split('\n').map((l) => l.trim()).filter(Boolean);
  const filasParsadas = [];
  let advertencia = null;

  // Intentar detectar el separador predominante
  for (const linea of lineas) {
    const numeros = (linea.match(/[\d.,]+/g) || [])
      .map((n) => parseFloat(n.replace(/\./g, '').replace(',', '.')))
      .filter((n) => !isNaN(n) && n >= 50 && n < 50_000_000);

    if (numeros.length === 0) continue;

    // Separar la línea: primero por tabulaciones, luego por 2+ espacios
    let partes = linea.includes('\t')
      ? linea.split('\t').map((p) => p.trim()).filter(Boolean)
      : linea.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);

    if (partes.length < 2) {
      // Como último recurso, separar por el primer número precedido de espacio
      const match = linea.match(/^(.+?)\s+([\d.,\s$]+)$/);
      if (match) partes = [match[1].trim(), match[2].trim()];
    }

    if (partes.length >= 2) {
      filasParsadas.push(partes);
    }
  }

  if (filasParsadas.length === 0) {
    return {
      columnas: ['Línea completa'],
      filas: lineas.filter((l) => /\d{3,}/.test(l)).map((l) => [l]),
      advertencia: 'No se pudo detectar la estructura del PDF. Revisá el mapeo manualmente.',
    };
  }

  // Normalizar al ancho máximo
  const maxCols = Math.min(Math.max(...filasParsadas.map((r) => r.length)), 8);

  // Detectar si la primera fila es un encabezado
  const primera = filasParsadas[0];
  const esCabecera = primera && primera.every((c) => !/^\d/.test(c) && isNaN(parseFloat(c.replace(',', '.'))));

  let columnas, filas;
  if (esCabecera) {
    // Rellenar columnas con nombres genéricos si hay menos de maxCols
    columnas = Array.from({ length: maxCols }, (_, i) => primera[i] || `Columna ${i + 1}`);
    filas = filasParsadas.slice(1).map((f) => Array.from({ length: maxCols }, (_, i) => f[i] ?? ''));
  } else {
    columnas = Array.from({ length: maxCols }, (_, i) => `Columna ${i + 1}`);
    filas = filasParsadas.map((f) => Array.from({ length: maxCols }, (_, i) => f[i] ?? ''));
  }

  if (filas.length < 5) {
    advertencia = `Solo se detectaron ${filas.length} filas. Si el PDF tiene formato complejo, intentá con el Excel del mismo proveedor.`;
  }

  return { columnas, filas, advertencia };
}
