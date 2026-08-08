import { getSheetsClient, getBatchRows, appendRow } from '../../../lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { query } = req.query;
    try {
      const sheets = await getSheetsClient();
      const { clientes = [], ventas = [] } = await getBatchRows(sheets, ['clientes', 'ventas']);
      const q = (query || '').trim().toLowerCase();

      const results = [];
      const seen = new Set();

      // Buscar en clientes
      clientes.forEach((c) => {
        const nom = (c.nombre || '').trim();
        const tel = (c.telefono || '').trim();
        if (!nom && !tel) return;
        const match = !q || nom.toLowerCase().includes(q) || tel.toLowerCase().includes(q);
        if (match) {
          const key = (nom + '|' + tel).toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push({ id: c.id, nombre: nom, telefono: tel, source: 'clientes' });
          }
        }
      });

      // Fallback: Buscar en ventas de gomería/caja si no se cubrió
      if (q && q.length >= 2) {
        ventas.forEach((v) => {
          const nom = (v.cliente || '').trim();
          const tel = (v.telefono || '').trim();
          if (!nom && !tel) return;
          const match = nom.toLowerCase().includes(q) || tel.toLowerCase().includes(q);
          if (match) {
            const key = (nom + '|' + tel).toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              results.push({ id: null, nombre: nom, telefono: tel, source: 'ventas' });
            }
          }
        });
      }

      return res.status(200).json(results.slice(0, 10));
    } catch (err) {
      console.error('[baterias/clientes]', err);
      return res.status(500).json({ error: 'Error al buscar clientes' });
    }
  }

  if (req.method === 'POST') {
    const { nombre, telefono } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'Nombre del cliente requerido' });
    }

    try {
      const sheets = await getSheetsClient();
      const { clientes = [] } = await getBatchRows(sheets, ['clientes']);
      const nomTrim = nombre.trim();
      const telTrim = (telefono || '').trim();

      // Buscar si ya existe por nombre o teléfono
      let existing = clientes.find((c) => {
        const cNom = (c.nombre || '').trim().toLowerCase();
        const cTel = (c.telefono || '').trim();
        if (telTrim && cTel && telTrim === cTel) return true;
        return cNom === nomTrim.toLowerCase();
      });

      if (existing) {
        return res.status(200).json({ cliente: existing, created: false });
      }

      const newId = uuidv4();
      const fechaAlta = new Date().toISOString();
      const newRow = [newId, nomTrim, telTrim, fechaAlta];
      await appendRow(sheets, 'clientes', newRow);

      const newClient = { id: newId, nombre: nomTrim, telefono: telTrim, fecha_alta: fechaAlta };
      return res.status(200).json({ cliente: newClient, created: true });
    } catch (err) {
      console.error('[baterias/clientes]', err);
      return res.status(500).json({ error: 'Error al crear cliente' });
    }
  }

  return res.status(405).end();
}
