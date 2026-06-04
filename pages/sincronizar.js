import { useState, useRef } from 'react';
import AuthGuard, { useAuth } from '../components/AuthGuard';

export default function SincronizarPage() {
  return (
    <AuthGuard pantalla="Sincronizar">
      <SincronizarContent />
    </AuthGuard>
  );
}

const ESTADO_COLORS = {
  actualizado: '#22c55e',
  sin_cambio: '#555',
  no_encontrado: '#f59e0b',
  error: '#ef4444',
};

function SincronizarContent() {
  const { sesion, onCambiarUsuario } = useAuth();

  // ─── Estado búsqueda manual ───────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');

  // ─── Estado sync masivo ───────────────────────────────────────────────────
  const [sincronizando, setSincronizando] = useState(false);
  const [resumenSync, setResumenSync] = useState(null);
  const [errorSync, setErrorSync] = useState('');
  const [progreso, setProgreso] = useState('');

  // ─── Categorías para agregar al catálogo ─────────────────────────────────
  const [modalProducto, setModalProducto] = useState(null); // producto de Fusión seleccionado
  const [categoriaSel, setCategoriaSel] = useState('aceites');
  const [marcaSel, setMarcaSel] = useState('');
  const [stockSel, setStockSel] = useState(0);
  const [agregando, setAgregando] = useState(false);
  const [msgAgregar, setMsgAgregar] = useState('');

  const inputRef = useRef();

  const CATEGORIAS = [
    { id: 'aceites', label: 'Aceites de motor' },
    { id: 'filtros', label: 'Filtros' },
    { id: 'bujias', label: 'Bujías' },
    { id: 'frenos', label: 'Frenos' },
    { id: 'refrigerante', label: 'Refrigerante' },
    { id: 'aditivos', label: 'Aditivos' },
    { id: 'accesorios', label: 'Accesorios' },
    { id: 'escobillas', label: 'Escobillas' },
  ];

  // ─── Buscar en Fusión ─────────────────────────────────────────────────────
  const buscar = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setBuscando(true);
    setErrorBusqueda('');
    setResultados(null);
    try {
      const res = await fetch('/api/lubricentro/sync/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'buscar', query: query.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de conexión con Fusión');
      setResultados(data.resultados || []);
    } catch (err) {
      setErrorBusqueda(err.message);
    } finally {
      setBuscando(false);
    }
  };

  // ─── Agregar producto de Fusión al catálogo ───────────────────────────────
  const agregarAlCatalogo = async () => {
    if (!modalProducto) return;
    setAgregando(true);
    setMsgAgregar('');
    try {
      // Traer margen de la categoría seleccionada
      const cfgRes = await fetch('/api/lubricentro/config');
      const cfgData = await cfgRes.json();
      const catCfg = cfgData.categorias?.find((c) => c.id === categoriaSel);
      const margen = catCfg?.margen || 40;
      const precioVenta = Math.ceil(modalProducto.precio_costo * (1 + margen / 100));

      // Crear ID a partir del nombre
      const id = (modalProducto.nombre || 'prod')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);

      const res = await fetch('/api/lubricentro/productos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          codigo: modalProducto.codigo || '',
          nombre: modalProducto.nombre,
          categoria: categoriaSel,
          marca: marcaSel,
          proveedor: 'fusion',
          precio_costo: modalProducto.precio_costo,
          precio_lista: modalProducto.precio_lista || '',
          margen,
          precio_venta: precioVenta,
          stock: stockSel,
          alerta_stock: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al agregar');
      setMsgAgregar('✅ Producto agregado al catálogo');
      setTimeout(() => { setModalProducto(null); setMsgAgregar(''); }, 1500);
    } catch (err) {
      setMsgAgregar(`❌ ${err.message}`);
    } finally {
      setAgregando(false);
    }
  };

  // ─── Sincronizar todos ────────────────────────────────────────────────────
  const sincronizarTodos = async () => {
    setSincronizando(true);
    setErrorSync('');
    setResumenSync(null);
    setProgreso('Conectando con Distribuidora Fusión...');
    try {
      const res = await fetch('/api/lubricentro/sync/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'sincronizar_todos' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en sincronización');
      setResumenSync(data.resumen);
    } catch (err) {
      setErrorSync(err.message);
    } finally {
      setSincronizando(false);
      setProgreso('');
    }
  };

  const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select{background:#111;border:1px solid #222;color:#ccc;border-radius:8px;padding:10px 14px;font-size:14px;outline:none;font-family:inherit}
        input:focus,select:focus{border-color:#3b82f6}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .2s ease-out}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .pulse{animation:pulse 1.5s ease-in-out infinite}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        .btn-primary{background:#3b82f6;border:none;color:#fff;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}
        .btn-primary:hover{background:#2563eb}
        .btn-primary:disabled{background:#1a1a1a;color:#333;cursor:not-allowed}
        .btn-ghost{background:transparent;border:1px solid #222;color:#555;border-radius:8px;padding:8px 16px;font-size:13px;cursor:pointer;transition:all .15s}
        .btn-ghost:hover{border-color:#444;color:#aaa}
        .card{background:#111;border:1px solid #1e1e1e;border-radius:14px;padding:24px}
        .tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;letter-spacing:.5px}
      `}</style>

      {/* Header */}
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🔄</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>SINCRONIZAR PRECIOS</div>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 3 }}>DISTRIBUIDORA FUSIÓN · ANTIGRAVITY</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin" style={{ fontSize: 12, color: '#555', textDecoration: 'none', border: '1px solid #222', padding: '5px 12px', borderRadius: 6 }}>← Admin</a>
          <a href="/importar" style={{ fontSize: 12, color: '#555', textDecoration: 'none', border: '1px solid #222', padding: '5px 12px', borderRadius: 6 }}>Importar Excel</a>
          <div style={{ width: 1, height: 24, background: '#1e1e1e' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>USUARIO</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ccc' }}>👤 {sesion?.nombre}</div>
          </div>
          <button onClick={onCambiarUsuario} className="btn-ghost" style={{ fontSize: 11, letterSpacing: 1, padding: '5px 12px' }}>CAMBIAR</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Banner estado Fusión */}
        <div style={{ background: 'linear-gradient(135deg,#0f1f40,#1a1a2e)', border: '1px solid #1e3a8a30', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏭</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Distribuidora Fusión</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Portal de revendedores · Usuario: {process.env.FUSION_USUARIO || '240'}</div>
            </div>
            <div className="tag" style={{ background: '#14532d', color: '#4ade80', marginLeft: 8 }}>● CONECTADO</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#444' }}>Sincronización masiva</div>
            <button
              onClick={sincronizarTodos}
              disabled={sincronizando}
              className="btn-primary"
              style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {sincronizando
                ? <><span style={{ width: 14, height: 14, border: '2px solid #444', borderTopColor: '#888', borderRadius: '50%', display: 'inline-block' }} className="spin" /> Sincronizando...</>
                : '🔄 Sincronizar todos los precios'}
            </button>
          </div>
        </div>

        {/* Progreso sync */}
        {progreso && (
          <div style={{ background: '#111', border: '1px solid #1e3a8a30', borderRadius: 10, padding: '12px 18px', fontSize: 13, color: '#93c5fd' }} className="pulse fade-up">
            ⏳ {progreso}
          </div>
        )}

        {/* Resumen sync */}
        {resumenSync && (
          <div className="card fade-up">
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 16 }}>Resultado de sincronización</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Actualizados', value: resumenSync.actualizados, color: '#22c55e', icon: '✅' },
                { label: 'Sin cambio', value: resumenSync.sin_cambio, color: '#888', icon: '⏸' },
                { label: 'Errores', value: resumenSync.errores, color: '#ef4444', icon: '❌' },
              ].map((s) => (
                <div key={s.label} style={{ background: '#0d0d0d', borderRadius: 10, padding: '16px', border: `1px solid ${s.color}20` }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: "'Barlow Condensed',sans-serif" }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {resumenSync.detalles?.length > 0 && (
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {resumenSync.detalles.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: '#0d0d0d' }}>
                    <span style={{ fontSize: 13, color: '#ccc' }}>{d.nombre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {d.estado === 'actualizado' && (
                        <span style={{ fontSize: 12, color: '#888' }}>
                          {fmt(d.anterior)} → <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(d.nuevo)}</span>
                        </span>
                      )}
                      <span className="tag" style={{ background: `${ESTADO_COLORS[d.estado]}20`, color: ESTADO_COLORS[d.estado] }}>
                        {d.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {errorSync && (
          <div style={{ background: '#2d1515', border: '1px solid #ef444430', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f87171' }}>
            ❌ {errorSync}
          </div>
        )}

        {/* Buscador manual */}
        <div className="card">
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Buscar producto en Fusión</div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 18 }}>
            Buscá por nombre o código. Los resultados muestran el precio que ven los revendedores.
          </div>

          <form onSubmit={buscar} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Motul 5100, filtro Tecneco, bujía Ektion..."
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn-primary" disabled={buscando || !query.trim()} style={{ minWidth: 120 }}>
              {buscando
                ? <span style={{ width: 16, height: 16, border: '2px solid #444', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                : '🔍 Buscar'}
            </button>
          </form>

          {errorBusqueda && (
            <div style={{ background: '#2d1515', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>
              ❌ {errorBusqueda}
            </div>
          )}

          {/* Resultados */}
          {resultados !== null && (
            <div className="fade-up">
              {resultados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#444' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                  <div>Sin resultados para "{query}" en Distribuidora Fusión</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
                    {resultados.length} resultado{resultados.length !== 1 ? 's' : ''} encontrado{resultados.length !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {resultados.map((prod, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#0d0d0d',
                          border: '1px solid #1e1e1e',
                          borderRadius: 10,
                          padding: '14px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'border-color .15s',
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f620'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#1e1e1e'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 2 }}>{prod.nombre}</div>
                          {prod.codigo && <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>Cód: {prod.codigo}</div>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#444', letterSpacing: 1 }}>PRECIO COSTO</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', fontFamily: "'Barlow Condensed',sans-serif" }}>
                              {fmt(prod.precio_costo)}
                            </div>
                          </div>
                          {prod.precio_lista && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: '#444', letterSpacing: 1 }}>P. LISTA</div>
                              <div style={{ fontSize: 15, fontWeight: 600, color: '#555', fontFamily: "'Barlow Condensed',sans-serif", textDecoration: 'line-through' }}>
                                {fmt(prod.precio_lista)}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => { setModalProducto(prod); setMarcaSel(''); setStockSel(0); setCategoriaSel('aceites'); }}
                            className="btn-primary"
                            style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '8px 16px' }}
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal: agregar producto al catálogo */}
      {modalProducto && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalProducto(null); }}
        >
          <div className="fade-up" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Agregar al catálogo</div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 20, fontStyle: 'italic' }}>{modalProducto.nombre}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Precios de referencia */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#0d0d0d', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 2 }}>PRECIO COSTO (Fusión)</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontFamily: "'Barlow Condensed',sans-serif" }}>{fmt(modalProducto.precio_costo)}</div>
                </div>
                <div style={{ background: '#0d0d0d', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, marginBottom: 2 }}>PRECIO LISTA</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#555', fontFamily: "'Barlow Condensed',sans-serif", textDecoration: modalProducto.precio_lista ? 'line-through' : 'none' }}>
                    {modalProducto.precio_lista ? fmt(modalProducto.precio_lista) : '—'}
                  </div>
                </div>
              </div>

              {/* Categoría */}
              <div>
                <label style={{ fontSize: 12, color: '#888', marginBottom: 6, display: 'block' }}>Categoría</label>
                <select value={categoriaSel} onChange={(e) => setCategoriaSel(e.target.value)} style={{ width: '100%' }}>
                  {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Marca */}
              <div>
                <label style={{ fontSize: 12, color: '#888', marginBottom: 6, display: 'block' }}>Marca (opcional)</label>
                <input
                  value={marcaSel}
                  onChange={(e) => setMarcaSel(e.target.value)}
                  placeholder="Ej: Motul, Tecneco, Darmet..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Stock inicial */}
              <div>
                <label style={{ fontSize: 12, color: '#888', marginBottom: 6, display: 'block' }}>Stock inicial</label>
                <input
                  type="number"
                  value={stockSel}
                  onChange={(e) => setStockSel(Number(e.target.value))}
                  min={0}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {msgAgregar && (
              <div style={{ marginTop: 14, fontSize: 13, color: msgAgregar.startsWith('✅') ? '#22c55e' : '#f87171' }}>
                {msgAgregar}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModalProducto(null)} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
              <button onClick={agregarAlCatalogo} disabled={agregando} className="btn-primary" style={{ flex: 2 }}>
                {agregando ? 'Agregando...' : '✓ Agregar al catálogo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
