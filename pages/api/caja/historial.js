import { getSheetsClient, getRows } from '../../../lib/sheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const ventas = await getRows(sheets, 'ventas');
    const items = await getRows(sheets, 'venta_items');

    const hoy = new Date().toLocaleDateString('es-AR');

    const cobradas = ventas
      .filter((v) => v.estado === 'cobrado' && v.fecha === hoy)
      .map((v) => ({
        id: v.id,
        fecha: v.fecha,
        hora: v.hora,
        hora_cobro: v.hora_cobro || '',
        origen: v.origen || 'caja',
        forma_pago: v.forma_pago || '',
        cliente: v.cliente || '',
        marketing: v.marketing || '',
        total: Number(v.total) || 0,
        patente: v.patente || '',
        marca: v.marca || '',
        modelo: v.modelo || '',
        telefono: v.telefono || '',
        es_efectivo: v.es_efectivo || 'false',
        items: items
          .filter((i) => i.venta_id === v.id)
          .map((i) => ({
            nombre: i.nombre_item || i.nombre || 'Servicio',
            cantidad: Number(i.cantidad) || 1,
            precio: Number(i.precio_unitario) || 0,
          })),
      }));

    // Métricas del día
    const totalDia = cobradas.reduce((s, v) => s + v.total, 0);

    const porFormaPago = {
      efectivo: 0, transferencia: 0, debito: 0, credito: 0, qr: 0,
    };
    cobradas.forEach((v) => {
      const fp = v.forma_pago?.toLowerCase();
      if (fp && porFormaPago.hasOwnProperty(fp)) porFormaPago[fp] += v.total;
    });

    const porMarketing = {};
    cobradas.forEach((v) => {
      const m = v.marketing || 'Sin registrar';
      porMarketing[m] = (porMarketing[m] || 0) + 1;
    });

    const porOrigen = { gomeria: 0, caja: 0 };
    cobradas.forEach((v) => {
      if (v.origen === 'gomeria') porOrigen.gomeria += v.total;
      else porOrigen.caja += v.total;
    });

    res.status(200).json({
      ventas: cobradas,
      metricas: {
        total_dia: totalDia,
        cantidad_ventas: cobradas.length,
        por_forma_pago: porFormaPago,
        por_marketing: porMarketing,
        por_origen: porOrigen,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer historial' });
  }
}
