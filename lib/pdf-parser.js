import { pathToFileURL } from 'url';
import path from 'path';

// Polyfill browser globals for Node.js (needed by pdfjs-dist)
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor(init) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (Array.isArray(init)) {
        if (init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
        }
      }
    }
    translate(x = 0, y = 0) {
      return new DOMMatrix([this.a, this.b, this.c, this.d, this.e + x, this.f + y]);
    }
    scale(sx = 1, sy = sx) {
      return new DOMMatrix([this.a * sx, this.b * sx, this.c * sy, this.d * sy, this.e, this.f]);
    }
    rotate(angle) {
      const r = (angle * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      return new DOMMatrix([c, s, -s, c, 0, 0]);
    }
    transformPoint(p = { x: 0, y: 0 }) {
      return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f };
    }
  };
}
if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = class Path2D {};
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.data = new Uint8ClampedArray(w * h * 4);
    }
  };
}

export async function parsearPDF(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  if (numPages === 0) {
    return { columnas: [], filas: [], total_filas: 0, advertencia: 'El PDF no tiene páginas' };
  }

  const allRawRows = [];
  const xCoords = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.filter((i) => i.str.trim());

    // Group items by Y coordinate with tolerance of 4
    const pageRows = [];
    items.forEach((item) => {
      const x = item.transform[4];
      const y = item.transform[5];
      const text = item.str.trim();

      const foundRow = pageRows.find((r) => Math.abs(r.y - y) <= 4);
      if (foundRow) {
        foundRow.items.push({ x, text });
      } else {
        pageRows.push({
          y,
          items: [{ x, text }],
        });
      }
    });

    // Sort page rows by Y descending
    pageRows.sort((a, b) => b.y - a.y);

    // Sort items within each row by X ascending
    pageRows.forEach((r) => {
      r.items.sort((a, b) => a.x - b.x);
    });

    // Filter page rows to ignore typical header/footer zones
    pageRows.forEach((r) => {
      if (r.y > 790 || r.y < 30) return;

      const finalItems = [];
      r.items.forEach((it) => {
        // Split combined code-description
        const match = it.text.match(/^([a-zA-Z0-9\/-]{3,25})\s+(.+)$/);
        if (match && /[\d\/-]/.test(match[1])) {
          finalItems.push({ x: it.x, text: match[1] });
          finalItems.push({ x: it.x + 80, text: match[2] });
        } else {
          finalItems.push(it);
        }
      });

      // Save for clustering
      finalItems.forEach((it) => xCoords.push(it.x));
      allRawRows.push({ y: r.y, items: finalItems });
    });
  }

  if (xCoords.length === 0) {
    return {
      columnas: [],
      filas: [],
      total_filas: 0,
      advertencia: 'El PDF parece estar vacío o es una imagen escaneada.',
    };
  }

  // Cluster X coordinates to discover columns (tolerance = 25)
  const sortedX = xCoords.slice().sort((a, b) => a - b);
  const clusters = [];
  sortedX.forEach((x) => {
    const found = clusters.find((c) => Math.abs(c.mean - x) <= 25);
    if (found) {
      found.values.push(x);
      found.mean = found.values.reduce((s, v) => s + v, 0) / found.values.length;
    } else {
      clusters.push({ mean: x, values: [x] });
    }
  });

  clusters.sort((a, b) => a.mean - b.mean);

  let advertencia = null;
  if (clusters.length < 2) {
    advertencia = 'No se pudo detectar la estructura del PDF. Revisá el mapeo manualmente.';
  }

  // Build final rows using clusters
  const finalRows = allRawRows.map((r) => {
    const rowData = Array(clusters.length).fill('');
    r.items.forEach((it) => {
      let minDiff = Infinity;
      let clusterIdx = -1;
      clusters.forEach((c, idx) => {
        const diff = Math.abs(c.mean - it.x);
        if (diff < minDiff) {
          minDiff = diff;
          clusterIdx = idx;
        }
      });
      if (clusterIdx !== -1) {
        rowData[clusterIdx] = rowData[clusterIdx] ? rowData[clusterIdx] + ' ' + it.text : it.text;
      }
    });
    return rowData;
  });

  // Filter out rows that are entirely empty
  const filteredRows = finalRows.filter((r) => r.some((c) => c.trim() !== ''));

  const maxCols = clusters.length;
  const columnas = Array.from({ length: maxCols }, (_, i) => `Columna ${i + 1}`);

  return {
    columnas,
    filas: filteredRows,
    total_filas: filteredRows.length,
    advertencia,
  };
}
