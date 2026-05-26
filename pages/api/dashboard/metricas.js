import { getSheetsClient, getRows } from '../../../lib/sheets';

function parseFechaAR(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const parts = fechaStr.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return isNaN(date.getTime()) ? null : date;
}

function startOfDay(d) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function filtrar(ventas, desde, hasta) {
  return ventas.filter((v) => {
    const f = parseFechaAR(v.fecha);
    if (!f) return false;
    return f >= desde && f <= hasta;
  });
}

function calcMetricas(ventasFiltradas) {
  const total = ventasFiltradas.reduce((s, v) => s + (Number(v.total) || 0), 0);
  const cantidad = ventasFiltradas.length;
  const porFormaPago = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, qr: 0 };
  ventasFiltradas.forEach((v) => {
    const fp = v.forma_pago?.toLowerCase?.();
    if (fp && fp in porFormaPago) porFormaPago[fp] += Number(v.total) || 0;
  });
  return { total, cantidad, porFormaPago };
}

function calcTop(ventas, items) {
  const ids = new Set(ventas.map((v) => v.id));
  const itemsFiltrados = items.filter((i) => ids.has(i.venta_id));
  const conteo = {};
  itemsFiltrados.forEach((i) => {
    const nombre = i.nombre_item || 'Servicio';
    if (!conteo[nombre]) conteo[nombre] = { cantidad: 0, monto: 0 };
    conteo[nombre].cantidad += Number(i.cantidad) || 1;
    conteo[nombre].monto += (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 1);
  });
  return Object.entries(conteo)
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
}

function calcFranja(ventas) {
  const franjas = {};
  for (let h = 0; h < 24; h++) franjas[h] = 0;
  ventas.forEach((v) => {
    if (v.hora) {
      const h = parseInt(v.hora.split(':')[0]);
      if (!isNaN(h) && h >= 0 && h < 24) franjas[h] += Number(v.total) || 0;
    }
  });
  return franjas;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const sheets = await getSheetsClient();
    const [ventas, items, productos] = await Promise.all([
      getRows(sheets, 'ventas'),
      getRows(sheets, 'venta_items'),
      getRows(sheets, 'productos_gomeria'),
    ]);

    const cobradas = ventas.filter((v) => v.estado === 'cobrado' && v.fecha);

    // --- Rango solicitado ---
    const { desde, hasta, modo } = req.query;
    let rangoDesde, rangoHasta;

    if (desde && hasta) {
      const d = parseFechaAR(decodeURIComponent(desde));
      const h = parseFechaAR(decodeURIComponent(hasta));
      rangoDesde = d ? startOfDay(d) : startOfDay(new Date());
      rangoHasta = h ? endOfDay(h) : endOfDay(new Date());
    } else {
      rangoDesde = startOfDay(new Date());
      rangoHasta = endOfDay(new Date());
    }

    // --- Período anterior (según modo) ---
    let anteriorDesde, anteriorHasta;
    const modoNorm = modo || 'hoy';

    if (modoNorm === 'hoy') {
      anteriorDesde = new Date(rangoDesde);
      anteriorDesde.setDate(anteriorDesde.getDate() - 1);
      anteriorHasta = endOfDay(new Date(anteriorDesde));
    } else if (modoNorm === 'semana') {
      anteriorDesde = new Date(rangoDesde);
      anteriorDesde.setDate(anteriorDesde.getDate() - 7);
      anteriorHasta = new Date(rangoHasta);
      anteriorHasta.setDate(anteriorHasta.getDate() - 7);
      anteriorHasta = endOfDay(anteriorHasta);
    } else if (modoNorm === 'mes') {
      anteriorDesde = new Date(rangoDesde.getFullYear(), rangoDesde.getMonth() - 1, 1);
      anteriorHasta = endOfDay(
        new Date(rangoHasta.getFullYear(), rangoHasta.getMonth() - 1, rangoHasta.getDate())
      );
    } else {
      // custom: previous N days
      const diffMs = rangoHasta.getTime() - rangoDesde.getTime();
      anteriorHasta = endOfDay(new Date(rangoDesde.getTime() - 86400000));
      anteriorDesde = startOfDay(new Date(anteriorHasta.getTime() - diffMs));
    }

    const ventasRango = filtrar(cobradas, rangoDesde, rangoHasta);
    const ventasAnterior = filtrar(cobradas, anteriorDesde, anteriorHasta);

    // --- Alertas de stock ---
    const alertasStock = productos
      .filter((p) => p.activo !== 'false')
      .filter((p) => (Number(p.stock) || 0) <= (Number(p.alerta_stock) || 1))
      .map((p) => ({
        nombre: p.nombre,
        medida: p.medida || '',
        marca: p.marca || '',
        stock: Number(p.stock) || 0,
        alerta_stock: Number(p.alerta_stock) || 1,
      }));

    res.status(200).json({
      metricas: calcMetricas(ventasRango),
      metricasAnterior: calcMetricas(ventasAnterior),
      top: calcTop(ventasRango, items),
      franjaHoraria: calcFranja(ventasRango),
      alertasStock,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular métricas' });
  }
}
