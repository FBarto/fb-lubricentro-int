import { getSheetsClient, updateRowWhere, appendRow, getBatchRows } from '../../../../lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') return res.status(405).end();

  const {
    ciclo_id,
    action,
    fin_v,
    fin_cca,
    reposo_v,
    reposo_cca,
    salud_pct,
    salud_nivel,
    salud_caida_v,
    estado_ciclo,
    precio_servicio,
  } = req.body;

  if (!ciclo_id) {
    return res.status(400).json({ error: 'ID de ciclo requerido' });
  }

  try {
    const sheets = await getSheetsClient();
    const updates = {};

    if (action === 'save_testing') {
      updates.fin_v = fin_v ? String(fin_v) : '12.00';
      updates.fin_cca = fin_cca ? String(fin_cca) : '';
      updates.estado_ciclo = 'reposo';
    } else if (action === 'save_reposo') {
      updates.reposo_v = reposo_v ? String(reposo_v) : '12.00';
      updates.reposo_cca = reposo_cca ? String(reposo_cca) : '';
      if (salud_pct !== undefined) updates.salud_pct = String(salud_pct);
      if (salud_nivel) updates.salud_nivel = String(salud_nivel);
      if (salud_caida_v !== undefined && salud_caida_v !== null) updates.salud_caida_v = String(salud_caida_v);
      updates.estado_ciclo = 'cerrado';
    } else if (action === 'update_status') {
      if (estado_ciclo) updates.estado_ciclo = String(estado_ciclo);
    } else if (action === 'enviar_caja') {
      const {
        ciclos_carga = [],
        fichas_carga = [],
      } = await getBatchRows(sheets, ['ciclos_carga', 'fichas_carga']);

      const ciclo = ciclos_carga.find((c) => c.id === ciclo_id);
      if (ciclo && !ciclo.venta_id) {
        const ficha = fichas_carga.find((f) => f.id === ciclo.ficha_id);
        const nomTrim = ficha ? ficha.cliente_nombre : 'Cliente Baterías';
        const telTrim = ficha ? ficha.cliente_telefono : '';
        const marcaTrim = ficha ? ficha.marca : 'Batería';
        const precioNum = Number(precio_servicio) || 0;

        const ventaId = uuidv4();
        const ahora = new Date();
        const fechaStr = ahora.toLocaleDateString('es-AR');
        const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

        await appendRow(sheets, 'ventas', [
          ventaId,
          fechaStr,
          horaStr,
          'baterias',
          'pendiente',
          '',
          nomTrim,
          'Carga Batería',
          precioNum,
          '',
          '',
          marcaTrim,
          '',
          telTrim,
          `Batería ${marcaTrim}`,
          'false',
        ]);

        await appendRow(sheets, 'venta_items', [
          uuidv4(),
          ventaId,
          `Carga de Batería (${marcaTrim})`,
          1,
          precioNum,
        ]);

        updates.venta_id = ventaId;
      }
    } else if (estado_ciclo) {
      updates.estado_ciclo = String(estado_ciclo);
    }

    if (Object.keys(updates).length > 0) {
      await updateRowWhere(sheets, 'ciclos_carga', 'id', ciclo_id, updates);
    }

    return res.status(200).json({ success: true, updates });
  } catch (err) {
    console.error('[baterias/carga/ciclo]', err);
    return res.status(500).json({ error: 'Error al actualizar el ciclo de carga' });
  }
}
