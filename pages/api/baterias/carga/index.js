import { getSheetsClient, getBatchRows, appendRow, updateRowWhere } from '../../../../lib/sheets';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sheets = await getSheetsClient();
      const {
        fichas_carga = [],
        ciclos_carga = [],
        clientes = [],
        ventas = [],
      } = await getBatchRows(sheets, ['fichas_carga', 'ciclos_carga', 'clientes', 'ventas']);

      // Mapeo de ventas para saber estado de cobro
      const ventasMap = new Map();
      ventas.forEach((v) => ventasMap.set(v.id, v));

      // Mapear fichas con sus ciclos
      const resultFichas = fichas_carga.map((f) => {
        const ciclosFicha = ciclos_carga
          .filter((c) => c.ficha_id === f.id)
          .map((c) => {
            const v = c.venta_id ? ventasMap.get(c.venta_id) : null;
            return {
              id: c.id,
              ficha_id: c.ficha_id,
              fecha: c.fecha,
              minutos: Number(c.minutos) || 0,
              estado_ciclo: c.estado_ciclo || 'cerrado',
              ingreso: (c.ingreso_v || c.ingreso_cca) ? { v: c.ingreso_v || '12.00', cca: c.ingreso_cca || null } : null,
              cargaFin: (c.fin_v || c.fin_cca) ? { v: c.fin_v || '12.00', cca: c.fin_cca || null } : null,
              reposo: (c.reposo_v || c.reposo_cca) ? { v: c.reposo_v || '12.00', cca: c.reposo_cca || null } : null,
              salud: c.salud_pct ? {
                pct: Number(c.salud_pct),
                nivel: c.salud_nivel || 'Regular',
                caida: c.salud_caida_v ? Number(c.salud_caida_v) : null,
              } : null,
              venta: v ? {
                id: v.id,
                estado: v.estado,
                total: Number(v.total) || 0,
                forma_pago: v.forma_pago || '',
              } : null,
            };
          })
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        return {
          id: f.id,
          cliente_id: f.cliente_id,
          cliente: f.cliente_nombre,
          telefono: f.cliente_telefono,
          marca: f.marca,
          ccaNominal: f.cca_nominal || null,
          key: f.key,
          ciclos: ciclosFicha,
        };
      });

      return res.status(200).json({ fichas: resultFichas });
    } catch (err) {
      console.error('[baterias/carga/index GET]', err);
      return res.status(500).json({ error: 'Error al consultar fichas de carga' });
    }
  }

  if (req.method === 'POST') {
    const {
      cliente_nombre,
      cliente_telefono,
      marca,
      cca_nominal,
      minutos,
      v_ingreso,
      cca_ingreso,
      precio_servicio,
      enviar_caja,
    } = req.body;

    if (!cliente_nombre || !marca || !minutos) {
      return res.status(400).json({ error: 'Cliente, marca y minutos son requeridos' });
    }

    try {
      const sheets = await getSheetsClient();
      const {
        clientes = [],
        fichas_carga = [],
      } = await getBatchRows(sheets, ['clientes', 'fichas_carga']);

      const nomTrim = cliente_nombre.trim();
      const telTrim = (cliente_telefono || '').trim();
      const marcaTrim = marca.trim();

      // 1. Obtener o crear cliente
      let clienteObj = clientes.find((c) => {
        if (telTrim && c.telefono && c.telefono.trim() === telTrim) return true;
        return (c.nombre || '').trim().toLowerCase() === nomTrim.toLowerCase();
      });

      let clienteId;
      if (clienteObj) {
        clienteId = clienteObj.id;
        if (telTrim && !clienteObj.telefono) {
          await updateRowWhere(sheets, 'clientes', 'id', clienteId, { telefono: telTrim });
        }
      } else {
        clienteId = uuidv4();
        await appendRow(sheets, 'clientes', [clienteId, nomTrim, telTrim, new Date().toISOString()]);
      }

      // 2. Obtener o crear ficha_carga
      const fichaKeyStr = `${nomTrim}|${marcaTrim}`.toLowerCase();
      let fichaObj = fichas_carga.find((f) => f.key === fichaKeyStr || (f.cliente_id === clienteId && f.marca.toLowerCase() === marcaTrim.toLowerCase()));

      let fichaId;
      if (fichaObj) {
        fichaId = fichaObj.id;
        if (cca_nominal && cca_nominal !== fichaObj.cca_nominal) {
          await updateRowWhere(sheets, 'fichas_carga', 'id', fichaId, { cca_nominal: String(cca_nominal) });
        }
      } else {
        fichaId = uuidv4();
        await appendRow(sheets, 'fichas_carga', [
          fichaId,
          clienteId,
          nomTrim,
          telTrim,
          marcaTrim,
          cca_nominal ? String(cca_nominal) : '',
          fichaKeyStr,
          new Date().toISOString(),
        ]);
      }

      // 3. Crear orden en Caja si se solicitó o si hay precio > 0
      let ventaId = '';
      const precioNum = Number(precio_servicio) || 0;
      if (enviar_caja || precioNum > 0) {
        ventaId = uuidv4();
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
      }

      // 4. Crear el ciclo de carga
      const cicloId = uuidv4();
      const ahoraIso = new Date().toISOString();
      const vIngVal = v_ingreso ? String(v_ingreso) : '';
      const ccaIngVal = cca_ingreso ? String(cca_ingreso) : '';

      await appendRow(sheets, 'ciclos_carga', [
        cicloId,
        fichaId,
        ahoraIso,
        Number(minutos),
        'activo', // activo | pausado | alarma | testing | reposo | cerrado | cancelado
        vIngVal,
        ccaIngVal,
        '', // fin_v
        '', // fin_cca
        '', // reposo_v
        '', // reposo_cca
        '', // salud_pct
        '', // salud_nivel
        '', // salud_caida_v
        ventaId,
      ]);

      return res.status(200).json({
        success: true,
        fichaId,
        cicloId,
        clienteId,
        ventaId,
      });
    } catch (err) {
      console.error('[baterias/carga/index POST]', err);
      return res.status(500).json({ error: 'Error al registrar la carga' });
    }
  }

  return res.status(405).end();
}
