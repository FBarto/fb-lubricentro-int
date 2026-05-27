import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import AuthGuard, { useAuth } from '../components/AuthGuard';


// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtARS = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) => d.toLocaleDateString('es-AR');

function getPeriodoDates(periodo) {
  const hoy = new Date();
  if (periodo === 'hoy') return { desde: fmtDate(hoy), hasta: fmtDate(hoy), modo: 'hoy' };
  if (periodo === 'semana') {
    const dia = hoy.getDay() || 7;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - (dia - 1));
    return { desde: fmtDate(lunes), hasta: fmtDate(hoy), modo: 'semana' };
  }
  if (periodo === 'mes') {
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: fmtDate(primero), hasta: fmtDate(hoy), modo: 'mes' };
  }
  return null;
}

function isoToAR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VariBadge({ actual, anterior }) {
  if (anterior == null || anterior === 0) return null;
  const v = Math.round(((actual - anterior) / anterior) * 100);
  const up = v >= 0;
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
      color: up ? '#10b981' : '#ef4444',
      background: up ? '#10b98118' : '#ef444418',
    }}>
      {up ? '↑' : '↓'} {Math.abs(v)}%
    </span>
  );
}

function StatCard({ label, value, valueNum, anteriorNum, sub }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
      padding: '28px 28px 22px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        fontSize: 42, fontWeight: 800, color: '#fff', letterSpacing: -1, lineHeight: 1,
      }}>{value}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minHeight: 22 }}>
        <VariBadge actual={valueNum} anterior={anteriorNum} />
        {sub && <span style={{ fontSize: 11, color: '#3a3a3a' }}>{sub}</span>}
      </div>
    </div>
  );
}

const FORMAS = [
  { key: 'efectivo',      label: 'Efectivo',       color: '#10b981' },
  { key: 'transferencia', label: 'Transferencia',  color: '#1d4ed8' },
  { key: 'debito',        label: 'Débito',         color: '#8b5cf6' },
  { key: 'credito',       label: 'Crédito',        color: '#f59e0b' },
  { key: 'qr',            label: 'QR',             color: '#06b6d4' },
];

function PagoCard({ porFormaPago }) {
  const total = Object.values(porFormaPago).reduce((s, v) => s + v, 0);
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
      padding: '28px', display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <span style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>
        Forma de pago
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FORMAS.map(({ key, label, color }) => {
          const val = porFormaPago[key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{fmtARS(val)}</span>
                  <span style={{ fontSize: 11, color: '#444', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
                </div>
              </div>
              <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3 }}>
                <div style={{
                  height: 5, background: color, borderRadius: 3,
                  width: `${pct}%`, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HorariosCard({ franjaHoraria }) {
  const HORAS = Array.from({ length: 17 }, (_, i) => i + 6); // 6am → 22pm
  const maxVal = Math.max(...HORAS.map((h) => franjaHoraria[h] || 0), 1);
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
      padding: '28px', display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      <span style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>
        Ventas por franja horaria
      </span>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90 }}>
        {HORAS.map((h) => {
          const val = franjaHoraria[h] || 0;
          const heightPct = Math.max((val / maxVal) * 100, val > 0 ? 4 : 0);
          return (
            <div key={h} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div
                title={val > 0 ? fmtARS(val) : ''}
                style={{
                  width: '100%', height: `${heightPct}%`,
                  background: val > 0 ? '#1d4ed8' : '#1a1a1a',
                  borderRadius: '3px 3px 0 0', transition: 'height 0.5s ease',
                  cursor: val > 0 ? 'default' : 'default',
                }}
              />
              <span style={{ fontSize: 9, color: '#333', userSelect: 'none' }}>{h}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopCard({ top }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: 16,
      padding: '28px', display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <span style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>
        Top servicios
      </span>
      {top.length === 0 && (
        <span style={{ color: '#333', fontSize: 14 }}>Sin ventas en este período</span>
      )}
      {top.slice(0, 8).map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: i === 0 ? '#f59e0b22' : i === 1 ? '#ffffff0a' : '#1a1a1a',
            color: i === 0 ? '#f59e0b' : i === 1 ? '#aaa' : '#444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800,
          }}>
            {i + 1}
          </span>
          <span style={{
            flex: 1, fontSize: 14, color: '#ccc',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.nombre}
          </span>
          <span style={{ fontSize: 12, color: '#555', flexShrink: 0 }}>×{item.cantidad}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {fmtARS(item.monto)}
          </span>
        </div>
      ))}
    </div>
  );
}

function StockAlerts({ alertasStock }) {
  if (!alertasStock?.length) return null;
  return (
    <div style={{
      background: '#110a00', border: '1px solid #f59e0b30',
      borderRadius: 16, padding: '28px', display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <span style={{ fontSize: 11, color: '#f59e0b', letterSpacing: 3, textTransform: 'uppercase' }}>
        ⚠️ Alertas de stock ({alertasStock.length})
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alertasStock.map((p, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#1a1000', borderRadius: 10, padding: '10px 14px',
          }}>
            <span style={{ fontSize: 13, color: '#ccc' }}>
              {p.nombre}
              {p.medida && <span style={{ color: '#555', marginLeft: 6 }}>{p.medida}</span>}
              {p.marca && <span style={{ color: '#444', marginLeft: 4 }}>· {p.marca}</span>}
            </span>
            <span style={{
              fontSize: 12, fontWeight: 800, flexShrink: 0,
              color: p.stock === 0 ? '#ef4444' : '#f59e0b',
            }}>
              {p.stock === 0 ? '⚫ Sin stock' : `${p.stock} u. (mín ${p.alerta_stock})`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Pages ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <AuthGuard pantalla="Dashboard">
      <Dashboard />
    </AuthGuard>
  );
}

const TABS = [
  { id: 'hoy',    label: 'HOY' },
  { id: 'semana', label: 'ESTA SEMANA' },
  { id: 'mes',    label: 'ESTE MES' },
  { id: 'custom', label: 'PERSONALIZADO' },
];

function Dashboard() {
  const router = useRouter();
  const { sesion, onCambiarUsuario } = useAuth();

  const [periodo, setPeriodo]       = useState('hoy');
  const [desdeInput, setDesdeInput] = useState('');
  const [hastaInput, setHastaInput] = useState('');

  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [fetchError, setFetchError] = useState('');

  const fetchData = useCallback(async (desde, hasta, modo) => {

    if (!desde || !hasta) return;
    setLoading(true);
    setFetchError('');
    try {
      const url = `/api/dashboard/metricas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}&modo=${modo || 'hoy'}`;
      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setData(json);
    } catch (err) {
      setFetchError('No se pudieron cargar las métricas. Verificá la conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on period change
  useEffect(() => {
    if (periodo === 'custom') return;
    const dates = getPeriodoDates(periodo);
    if (dates) fetchData(dates.desde, dates.hasta, dates.modo);
  }, [periodo, fetchData]);


  function handleCustomSearch() {
    if (!desdeInput || !hastaInput) return;
    fetchData(isoToAR(desdeInput), isoToAR(hastaInput), 'custom');
  }

  function handleRefresh() {
    if (periodo === 'custom') {
      handleCustomSearch();
    } else {
      const dates = getPeriodoDates(periodo);
      if (dates) fetchData(dates.desde, dates.hasta, dates.modo);
    }
  }

  const m  = data?.metricas;
  const ma = data?.metricasAnterior;

  const labelAnterior = {
    hoy:    'vs ayer',
    semana: 'vs semana anterior',
    mes:    'vs mes anterior',
    custom: 'vs período anterior',
  }[periodo];

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      fontFamily: "'Barlow Condensed', Arial, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; background: #111; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
        button { font-family: inherit; }
        input[type="date"] { color-scheme: dark; }
        .tab-btn:hover { border-color: #333 !important; color: #aaa !important; }
        .icon-btn:hover { background: #1e1e1e !important; color: #ccc !important; }
        .salir-btn:hover { border-color: #444 !important; color: #999 !important; }
        .custom-search:hover { background: #2563eb !important; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        background: '#0e0e0e', borderBottom: '1px solid #1a1a1a',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 64,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>📊</span>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 2, lineHeight: 1 }}>
              FB LUBRICENTRO
            </div>
            <div style={{ fontSize: 9, color: '#333', letterSpacing: 4, textTransform: 'uppercase' }}>
              Dashboard de métricas
            </div>
          </div>
        </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ textAlign: 'right', marginRight: 4 }}>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>Usuario</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ccc' }}>👤 {sesion?.nombre}</div>
          </div>
          <button
            onClick={handleRefresh}
            className="icon-btn"
            title="Actualizar"
            style={{
              background: '#141414', border: '1px solid #1e1e1e', borderRadius: 9,
              padding: '8px 13px', color: '#555', cursor: 'pointer', fontSize: 16,
              transition: 'all 0.15s',
            }}
          >
            🔄
          </button>
          <button
            onClick={() => router.push('/')}
            className="salir-btn"
            style={{
              background: 'none', border: '1px solid #1e1e1e', borderRadius: 9,
              padding: '8px 16px', color: '#444', cursor: 'pointer',
              fontSize: 11, letterSpacing: 2, transition: 'all 0.15s',
            }}
          >
            ← INICIO
          </button>
          <button
            onClick={onCambiarUsuario}
            className="salir-btn"
            style={{
              background: 'none', border: '1px solid #1e1e1e', borderRadius: 9,
              padding: '8px 16px', color: '#444', cursor: 'pointer',
              fontSize: 11, letterSpacing: 2, transition: 'all 0.15s',
            }}
          >
            SALIR
          </button>
        </div>

      </header>

      {/* ── Main ── */}
      <main style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {TABS.map((tab) => {
            const active = periodo === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPeriodo(tab.id)}
                className={active ? '' : 'tab-btn'}
                style={{
                  background: active ? '#1d4ed8' : '#111',
                  border: `1px solid ${active ? '#1d4ed8' : '#1e1e1e'}`,
                  borderRadius: 10, padding: '9px 22px',
                  color: active ? '#fff' : '#555',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700, letterSpacing: 1,
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            );
          })}

          {periodo === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 4 }}>
              <input
                type="date"
                value={desdeInput}
                onChange={(e) => setDesdeInput(e.target.value)}
                style={{
                  background: '#111', border: '1px solid #2a2a2a', borderRadius: 9,
                  padding: '9px 14px', color: '#ccc', fontSize: 13, outline: 'none',
                }}
              />
              <span style={{ color: '#333', fontSize: 16 }}>→</span>
              <input
                type="date"
                value={hastaInput}
                onChange={(e) => setHastaInput(e.target.value)}
                style={{
                  background: '#111', border: '1px solid #2a2a2a', borderRadius: 9,
                  padding: '9px 14px', color: '#ccc', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={handleCustomSearch}
                className="custom-search"
                style={{
                  background: '#1d4ed8', border: 'none', borderRadius: 9,
                  padding: '9px 20px', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700, letterSpacing: 1, transition: 'background 0.15s',
                }}
              >
                BUSCAR
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{
            background: '#ef444412', border: '1px solid #ef444430',
            borderRadius: 12, padding: '14px 20px', color: '#ef4444', fontSize: 14,
          }}>
            {fetchError}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{
            textAlign: 'center', padding: '80px 0', color: '#333', fontSize: 14, letterSpacing: 2,
          }}>
            CARGANDO MÉTRICAS...
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <>
            {/* ── Stat cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <StatCard
                label="Total vendido"
                value={fmtARS(m?.total)}
                valueNum={m?.total || 0}
                anteriorNum={ma?.total}
                sub={labelAnterior}
              />
              <StatCard
                label="Órdenes"
                value={m?.cantidad || 0}
                valueNum={m?.cantidad || 0}
                anteriorNum={ma?.cantidad}
                sub={labelAnterior}
              />
              <StatCard
                label="Ticket promedio"
                value={m?.cantidad > 0 ? fmtARS(m.total / m.cantidad) : fmtARS(0)}
                valueNum={m?.cantidad > 0 ? m.total / m.cantidad : 0}
                anteriorNum={ma?.cantidad > 0 ? ma.total / ma.cantidad : 0}
                sub="por venta"
              />
            </div>

            {/* ── Pago + Horarios ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }}>
              <PagoCard porFormaPago={m?.porFormaPago || {}} />
              <HorariosCard franjaHoraria={data.franjaHoraria || {}} />
            </div>

            {/* ── Top + Stock ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: data.alertasStock?.length > 0 ? '1fr 1fr' : '1fr',
              gap: 16,
            }}>
              <TopCard top={data.top || []} />
              {data.alertasStock?.length > 0 && <StockAlerts alertasStock={data.alertasStock} />}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !data && !fetchError && periodo === 'custom' && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#333', fontSize: 14 }}>
            Seleccioná un rango de fechas y tocá BUSCAR
          </div>
        )}
      </main>
    </div>
  );
}
