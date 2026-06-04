import { useState, useEffect } from 'react';
import AuthGuard, { useAuth } from '../components/AuthGuard';

const GRUPOS = ['Autos', 'Motos', 'Camionetas', 'Otros'];
const ROLES = ['admin', 'cajero'];
const CATEGORIAS_LUB = [
  { id: 'aceites',      label: 'Aceites de motor' },
  { id: 'filtros',      label: 'Filtros' },
  { id: 'bujias',       label: 'Bujías' },
  { id: 'frenos',       label: 'Frenos' },
  { id: 'refrigerante', label: 'Refrigerante' },
  { id: 'aditivos',     label: 'Aditivos' },
  { id: 'accesorios',   label: 'Accesorios' },
  { id: 'escobillas',   label: 'Escobillas' },
];


const fmt = (n) => '$' + Number(n || 0).toLocaleString('es-AR');

export default function AdminPage() {
  return (
    <AuthGuard pantalla="Admin" requiereAdmin>
      <AdminContent />
    </AuthGuard>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000cc', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#141414', border: '1px solid #222', borderRadius: 16,
        padding: '28px 28px 24px', width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 30px 80px #000',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
            {title}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Campo de formulario ──────────────────────────────────────────────────────
function Campo({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 10, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
        {hint && <span style={{ color: '#333', marginLeft: 6, textTransform: 'none', letterSpacing: 0 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', background: '#0f0f0f', border: '1px solid #222', borderRadius: 8,
  padding: '10px 12px', color: '#ccc', fontSize: 14, fontFamily: 'inherit',
};

// ─── Botones de modal ─────────────────────────────────────────────────────────
function BotonesModal({ onClose, onGuardar, guardando, label = 'GUARDAR' }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
      <button onClick={onClose} style={{ flex: 1, padding: '11px', background: '#1a1a1a', border: '1px solid #222', borderRadius: 8, color: '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        CANCELAR
      </button>
      <button onClick={onGuardar} disabled={guardando} style={{
        flex: 2, padding: '11px', background: guardando ? '#1a1a1a' : '#1d4ed8',
        border: 'none', borderRadius: 8, color: guardando ? '#444' : '#fff',
        fontSize: 14, fontWeight: 800, cursor: guardando ? 'not-allowed' : 'pointer',
        fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1,
      }}>
        {guardando ? 'Guardando...' : label}
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? '#16a34a' : '#1a1a1a',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: value ? '#fff' : '#444',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ─── Contenido principal ──────────────────────────────────────────────────────
function AdminContent() {
  const { sesion, onCambiarUsuario } = useAuth();
  const [tab, setTab] = useState('servicios');

  // Datos
  const [servicios, setServicios]       = useState([]);
  const [productos, setProductos]       = useState([]);
  const [usuarios, setUsuarios]         = useState([]);
  const [prodLub, setProdLub]           = useState([]);
  const [margenes, setMargenes]         = useState([]);
  const [cargando, setCargando]         = useState(true);

  // Modales
  const [modalServicio, setModalServicio]         = useState(null);
  const [modalProducto, setModalProducto]         = useState(null);
  const [modalStock, setModalStock]               = useState(null);
  const [modalUsuario, setModalUsuario]           = useState(null);
  const [modalLub, setModalLub]                   = useState(null); // 'crear'|'editar'
  const [modalMargenes, setModalMargenes]         = useState(false);
  const [itemActivo, setItemActivo]               = useState(null);

  // Feedback
  const [toast, setToast] = useState(null);

  function mostrarToast(msg, tipo = 'ok') {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  }

  async function cargarTodo() {
    setCargando(true);
    try {
      const [sRes, pRes, uRes, lRes, mRes] = await Promise.all([
        fetch('/api/admin/servicios'),
        fetch('/api/admin/productos'),
        fetch('/api/admin/usuarios'),
        fetch('/api/lubricentro/productos'),
        fetch('/api/lubricentro/config'),
      ]);
      setServicios(sRes.ok ? await sRes.json() : []);
      setProductos(pRes.ok ? await pRes.json() : []);
      setUsuarios(uRes.ok  ? await uRes.json()  : []);
      setProdLub(lRes.ok   ? await lRes.json()  : []);
      const mData = mRes.ok ? await mRes.json() : {};
      setMargenes(mData.categorias || []);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargarTodo(); }, []);

  // ── Toggle activo inline ─────────────────────────────────────────────────────
  async function toggleServicio(id, nuevoActivo) {
    await fetch(`/api/admin/servicios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: String(nuevoActivo) }),
    });
    setServicios((prev) => prev.map((s) => s.id === id ? { ...s, activo: String(nuevoActivo) } : s));
  }

  async function toggleProducto(id, nuevoActivo) {
    await fetch(`/api/admin/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: String(nuevoActivo) }),
    });
    setProductos((prev) => prev.map((p) => p.id === id ? { ...p, activo: String(nuevoActivo) } : p));
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter','Segoe UI',sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        input,select{outline:none;}
        input:focus,select:focus{border-color:#3b82f6!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.2s ease-out}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .toast{animation:toastIn 0.25s ease-out}
        .row-item:hover{background:#161616!important}
        .btn-sm:hover{border-color:#444!important;color:#ccc!important}
      `}</style>

      {/* Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1e1e1e', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>FB LUBRICENTRO</div>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 3 }}>ADMIN · ANTIGRAVITY</div>
          </div>
          <div style={{ width: 1, height: 32, background: '#222' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'servicios',   label: '⚙️ Servicios' },
              { id: 'productos',   label: '📦 Productos' },
              { id: 'lubricentro', label: '🪢 Lubricentro' },
              { id: 'usuarios',    label: '👤 Usuarios' },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: tab === t.id ? '#1d4ed8' : 'transparent', color: tab === t.id ? '#fff' : '#555', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>Admin</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ccc' }}>⚙️ {sesion?.nombre}</div>
          </div>
          <button onClick={onCambiarUsuario}
            style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: '7px 13px', color: '#555', fontSize: 11, fontWeight: 600, letterSpacing: 1, cursor: 'pointer' }}>
            CAMBIAR
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {cargando && (
            <div style={{ textAlign: 'center', color: '#333', padding: 60, fontSize: 14 }}>Cargando datos...</div>
          )}

          {/* ── TAB SERVICIOS ── */}
          {!cargando && tab === 'servicios' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
                  {servicios.length} servicios
                </div>
                <button onClick={() => { setItemActivo({}); setModalServicio('crear'); }}
                  style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nuevo Servicio
                </button>
              </div>

              {GRUPOS.map((grupo) => {
                const lista = servicios.filter((s) => s.grupo === grupo);
                if (lista.length === 0) return null;
                return (
                  <div key={grupo} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: '#3b82f6', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #1a1a1a' }}>
                      {grupo}
                    </div>
                    {lista.map((s) => (
                      <div key={s.id} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 4, background: 'transparent', transition: 'background 0.15s' }}>
                        <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: s.activo === 'true' ? '#ddd' : '#444' }}>{s.label}</div>
                          <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>{s.id}</div>
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, color: s.activo === 'true' ? '#fff' : '#333', minWidth: 90, textAlign: 'right' }}>
                          {fmt(s.precio)}
                        </div>
                        <Toggle value={s.activo === 'true'} onChange={(v) => toggleServicio(s.id, v)} />
                        <button className="btn-sm" onClick={() => { setItemActivo({ ...s }); setModalServicio('editar'); }}
                          style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                          Editar
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Servicios sin grupo conocido */}
              {servicios.filter((s) => !GRUPOS.includes(s.grupo)).length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#555', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Sin grupo</div>
                  {servicios.filter((s) => !GRUPOS.includes(s.grupo)).map((s) => (
                    <div key={s.id} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: s.activo === 'true' ? '#ddd' : '#444' }}>{s.label}</div>
                        <div style={{ fontSize: 11, color: '#555', fontFamily: 'monospace' }}>{s.id}</div>
                      </div>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, color: s.activo === 'true' ? '#fff' : '#333', minWidth: 90, textAlign: 'right' }}>
                        {fmt(s.precio)}
                      </div>
                      <Toggle value={s.activo === 'true'} onChange={(v) => toggleServicio(s.id, v)} />
                      <button className="btn-sm" onClick={() => { setItemActivo({ ...s }); setModalServicio('editar'); }}
                        style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Editar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB PRODUCTOS ── */}
          {!cargando && tab === 'productos' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
                  {productos.length} productos
                </div>
                <button onClick={() => { setItemActivo({}); setModalProducto('crear'); }}
                  style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nuevo Producto
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {productos.map((p) => {
                  const stockBajo = Number(p.stock) <= Number(p.alerta_stock) && Number(p.alerta_stock) > 0;
                  return (
                    <div key={p.id} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: 'transparent', transition: 'background 0.15s', borderLeft: stockBajo ? '3px solid #ef4444' : '3px solid transparent' }}>
                      <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{p.icon || '📦'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: p.activo === 'true' ? '#ddd' : '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.nombre}
                        </div>
                        <div style={{ fontSize: 11, color: '#555' }}>
                          {[p.marca, p.medida].filter(Boolean).join(' · ')}
                          <span style={{ fontFamily: 'monospace', marginLeft: 6, color: '#333' }}>{p.id}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <div style={{ fontSize: 11, color: '#555' }}>Normal</div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: p.activo === 'true' ? '#fff' : '#333' }}>{fmt(p.precio)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <div style={{ fontSize: 11, color: '#555' }}>Efectivo</div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: p.activo === 'true' ? '#4ade80' : '#333' }}>{fmt(p.precio_efectivo)}</div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 60 }}>
                        <div style={{ fontSize: 11, color: stockBajo ? '#ef4444' : '#555' }}>Stock</div>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, color: stockBajo ? '#ef4444' : (p.activo === 'true' ? '#fff' : '#333') }}>
                          {p.stock}
                        </div>
                      </div>
                      <Toggle value={p.activo === 'true'} onChange={(v) => toggleProducto(p.id, v)} />
                      <button className="btn-sm" onClick={() => { setItemActivo({ ...p }); setModalStock('ajustar'); }}
                        style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                        ± Stock
                      </button>
                      <button className="btn-sm" onClick={() => { setItemActivo({ ...p }); setModalProducto('editar'); }}
                        style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                        Editar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB LUBRICENTRO ── */}
          {!cargando && tab === 'lubricentro' && (
            <div className="fade-in">
              {/* Encabezado con acciones */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 11, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
                    {prodLub.length} productos
                  </div>
                  <a href="/sincronizar"
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #1e3a8a', color: '#93c5fd', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔄 Sincronizar con Fusión
                  </a>
                  <button
                    onClick={() => setModalMargenes(true)}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #333', color: '#888', background: 'none', cursor: 'pointer' }}>
                    ⚙️ Márgenes
                  </button>
                </div>
                <button onClick={() => { setItemActivo({}); setModalLub('crear'); }}
                  style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nuevo Producto
                </button>
              </div>

              {/* Lista por categoría */}
              {CATEGORIAS_LUB.map((cat) => {
                const lista = prodLub.filter((p) => p.categoria === cat.id);
                if (lista.length === 0) return null;
                const margenCat = margenes.find((m) => m.id === cat.id)?.margen || 40;
                return (
                  <div key={cat.id} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: '#8b5cf6', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{cat.label}</span>
                      <span style={{ color: '#555', fontWeight: 400 }}>margen {margenCat}%</span>
                    </div>
                    {lista.map((p) => {
                      const stockBajo = Number(p.stock) <= Number(p.alerta_stock) && Number(p.alerta_stock) > 0;
                      return (
                        <div key={p.id} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 4, transition: 'background 0.15s', borderLeft: stockBajo ? '3px solid #ef4444' : '3px solid transparent' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: p.activo === 'true' ? '#ddd' : '#444', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
                            <div style={{ fontSize: 11, color: '#555' }}>
                              {[p.marca, p.proveedor && `via ${p.proveedor}`].filter(Boolean).join(' · ')}
                              {p.ultima_actualizacion && <span style={{ marginLeft: 8, color: '#333' }}>act. {p.ultima_actualizacion}</span>}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 90 }}>
                            <div style={{ fontSize: 10, color: '#555' }}>Costo</div>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: '#f59e0b' }}>{fmt(p.precio_costo)}</div>
                          </div>
                          <div style={{ textAlign: 'right', minWidth: 90 }}>
                            <div style={{ fontSize: 10, color: '#555' }}>Venta</div>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, color: p.activo === 'true' ? '#fff' : '#333' }}>{fmt(p.precio_venta)}</div>
                          </div>
                          <div style={{ textAlign: 'center', minWidth: 50 }}>
                            <div style={{ fontSize: 10, color: stockBajo ? '#ef4444' : '#555' }}>Stock</div>
                            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, color: stockBajo ? '#ef4444' : (p.activo === 'true' ? '#fff' : '#333') }}>{p.stock}</div>
                          </div>
                          <button className="btn-sm" onClick={() => { setItemActivo({ ...p }); setModalLub('editar'); }}
                            style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Editar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {prodLub.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#333' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🪢</div>
                  <div style={{ marginBottom: 8 }}>No hay productos en el catálogo lubricentro todavía.</div>
                  <div style={{ fontSize: 13, color: '#444' }}>Usá “Sincronizar con Fusión” o “Nuevo Producto” para empezar.</div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB USUARIOS ── */}
          {!cargando && tab === 'usuarios' && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#444', letterSpacing: 2, textTransform: 'uppercase' }}>
                  {usuarios.length} usuarios
                </div>
                <button onClick={() => { setItemActivo({}); setModalUsuario('crear'); }}
                  style={{ background: '#1d4ed8', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Nuevo Usuario
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {usuarios.map((u) => (
                  <div key={u.usuario} className="row-item" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 8, background: 'transparent', transition: 'background 0.15s' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: u.rol === 'admin' ? '#1d4ed8' : '#222',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800,
                      color: u.rol === 'admin' ? '#93c5fd' : '#555',
                      flexShrink: 0,
                    }}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>{u.nombre}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>@{u.usuario}</div>
                    </div>
                    <span style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 4, fontWeight: 700, letterSpacing: 1,
                      background: u.rol === 'admin' ? '#1d4ed822' : '#1a1a1a',
                      color: u.rol === 'admin' ? '#3b82f6' : '#555',
                      border: `1px solid ${u.rol === 'admin' ? '#3b82f633' : '#222'}`,
                    }}>
                      {u.rol?.toUpperCase() || 'CAJERO'}
                    </span>
                    <button className="btn-sm" onClick={() => { setItemActivo({ ...u }); setModalUsuario('editar'); }}
                      style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '5px 10px', color: '#555', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                      Editar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toast.tipo === 'ok' ? '#16a34a' : '#ef4444',
          color: '#fff', borderRadius: 10, padding: '12px 24px',
          fontSize: 14, fontWeight: 700, zIndex: 200,
          boxShadow: '0 8px 32px #00000066',
        }}>
          {toast.tipo === 'ok' ? '✓ ' : '⚠️ '}{toast.msg}
        </div>
      )}

      {/* ── MODAL EDITAR/CREAR SERVICIO ── */}
      {modalServicio && itemActivo && (
        <ModalServicio
          modo={modalServicio}
          inicial={itemActivo}
          onClose={() => { setModalServicio(null); setItemActivo(null); }}
          onGuardado={async () => {
            setModalServicio(null); setItemActivo(null);
            mostrarToast(modalServicio === 'crear' ? 'Servicio creado' : 'Servicio actualizado');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {/* ── MODAL EDITAR/CREAR PRODUCTO ── */}
      {modalProducto && itemActivo && (
        <ModalProducto
          modo={modalProducto}
          inicial={itemActivo}
          onClose={() => { setModalProducto(null); setItemActivo(null); }}
          onGuardado={async () => {
            setModalProducto(null); setItemActivo(null);
            mostrarToast(modalProducto === 'crear' ? 'Producto creado' : 'Producto actualizado');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {/* ── MODAL AJUSTE STOCK ── */}
      {modalStock && itemActivo && (
        <ModalStock
          producto={itemActivo}
          onClose={() => { setModalStock(null); setItemActivo(null); }}
          onGuardado={async () => {
            setModalStock(null); setItemActivo(null);
            mostrarToast('Stock actualizado');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {/* ── MODAL EDITAR/CREAR USUARIO ── */}
      {modalUsuario && itemActivo && (
        <ModalUsuario
          modo={modalUsuario}
          inicial={itemActivo}
          onClose={() => { setModalUsuario(null); setItemActivo(null); }}
          onGuardado={async () => {
            setModalUsuario(null); setItemActivo(null);
            mostrarToast(modalUsuario === 'crear' ? 'Usuario creado' : 'Usuario actualizado');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {/* ── MODAL MÁRGENES LUBRICENTRO ── */}
      {modalMargenes && (
        <ModalMargenes
          margenes={margenes}
          onClose={() => setModalMargenes(false)}
          onGuardado={async () => {
            setModalMargenes(false);
            mostrarToast('Márgenes actualizados');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}

      {/* ── MODAL PRODUCTO LUBRICENTRO ── */}
      {modalLub && itemActivo && (
        <ModalLubricentro
          modo={modalLub}
          inicial={itemActivo}
          margenes={margenes}
          onClose={() => { setModalLub(null); setItemActivo(null); }}
          onGuardado={async () => {
            setModalLub(null); setItemActivo(null);
            mostrarToast(modalLub === 'crear' ? 'Producto creado' : 'Producto actualizado');
            await cargarTodo();
          }}
          onError={(msg) => mostrarToast(msg, 'error')}
        />
      )}
    </div>
  );
}

// ─── Modal Servicio ──────────────────────────────────────────────────────────
function ModalServicio({ modo, inicial, onClose, onGuardado, onError }) {
  const [form, setForm] = useState({
    id: inicial.id || '',
    grupo: inicial.grupo || 'Autos',
    label: inicial.label || '',
    icon: inicial.icon || '🔧',
    precio: inicial.precio || '',
    activo: inicial.activo ?? 'true',
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form.label || !form.precio) return onError('Completá nombre y precio');
    if (modo === 'crear' && !form.id) return onError('El ID es obligatorio');
    setGuardando(true);
    try {
      const url = modo === 'crear' ? '/api/admin/servicios' : `/api/admin/servicios/${inicial.id}`;
      const method = modo === 'crear' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al guardar');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={modo === 'crear' ? 'Nuevo Servicio' : `Editar: ${inicial.label}`} onClose={onClose}>
      {modo === 'crear' && (
        <Campo label="ID" hint="— solo letras, números y guiones bajos">
          <input value={form.id} onChange={(e) => set('id', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="ej: balanceo_auto" style={inputStyle} />
        </Campo>
      )}
      <Campo label="Grupo">
        <select value={form.grupo} onChange={(e) => set('grupo', e.target.value)} style={inputStyle}>
          {GRUPOS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Campo>
      <Campo label="Nombre del servicio">
        <input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="ej: Balanceo Auto" style={inputStyle} />
      </Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Ícono (emoji)">
          <input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="🔧" style={inputStyle} />
        </Campo>
        <Campo label="Precio ($)">
          <input type="number" value={form.precio} onChange={(e) => set('precio', e.target.value)} placeholder="0" style={inputStyle} />
        </Campo>
      </div>
      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} />
    </Modal>
  );
}

// ─── Modal Producto ───────────────────────────────────────────────────────────
function ModalProducto({ modo, inicial, onClose, onGuardado, onError }) {
  const [form, setForm] = useState({
    id: inicial.id || '',
    nombre: inicial.nombre || '',
    icon: inicial.icon || '📦',
    marca: inicial.marca || '',
    medida: inicial.medida || '',
    precio: inicial.precio || '',
    precio_efectivo: inicial.precio_efectivo || '',
    stock: inicial.stock || '0',
    alerta_stock: inicial.alerta_stock || '0',
    activo: inicial.activo ?? 'true',
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form.nombre || !form.precio) return onError('Completá nombre y precio');
    if (modo === 'crear' && !form.id) return onError('El ID es obligatorio');
    setGuardando(true);
    try {
      const url = modo === 'crear' ? '/api/admin/productos' : `/api/admin/productos/${inicial.id}`;
      const method = modo === 'crear' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al guardar');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={modo === 'crear' ? 'Nuevo Producto' : `Editar: ${inicial.nombre}`} onClose={onClose}>
      {modo === 'crear' && (
        <Campo label="ID" hint="— solo letras, números y guiones bajos">
          <input value={form.id} onChange={(e) => set('id', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="ej: cam_moto_3" style={inputStyle} />
        </Campo>
      )}
      <Campo label="Nombre">
        <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="ej: Cubierta Moto 3.00-17" style={inputStyle} />
      </Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <Campo label="Ícono">
          <input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="📦" style={inputStyle} />
        </Campo>
        <Campo label="Marca">
          <input value={form.marca} onChange={(e) => set('marca', e.target.value)} placeholder="ej: Fate" style={inputStyle} />
        </Campo>
        <Campo label="Medida">
          <input value={form.medida} onChange={(e) => set('medida', e.target.value)} placeholder="ej: 175/65 R14" style={inputStyle} />
        </Campo>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Precio normal ($)">
          <input type="number" value={form.precio} onChange={(e) => set('precio', e.target.value)} placeholder="0" style={inputStyle} />
        </Campo>
        <Campo label="Precio efectivo ($)">
          <input type="number" value={form.precio_efectivo} onChange={(e) => set('precio_efectivo', e.target.value)} placeholder="0" style={inputStyle} />
        </Campo>
        <Campo label="Stock inicial">
          <input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder="0" style={inputStyle} />
        </Campo>
        <Campo label="Alerta stock mínimo">
          <input type="number" value={form.alerta_stock} onChange={(e) => set('alerta_stock', e.target.value)} placeholder="0" style={inputStyle} />
        </Campo>
      </div>
      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} />
    </Modal>
  );
}

// ─── Modal Ajuste Stock ───────────────────────────────────────────────────────
function ModalStock({ producto, onClose, onGuardado, onError }) {
  const [ajuste, setAjuste]     = useState('');
  const [guardando, setGuardando] = useState(false);

  const nuevoStock = Math.max(0, Number(producto.stock || 0) + Number(ajuste || 0));

  async function guardar() {
    if (ajuste === '' || ajuste === '0') return onError('Ingresá un ajuste distinto de cero');
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/productos/${producto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ajuste_stock: Number(ajuste) }),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al ajustar stock');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={`Ajustar stock: ${producto.nombre}`} onClose={onClose}>
      <div style={{ background: '#0f0f0f', borderRadius: 10, padding: '14px 16px', marginBottom: 18, display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>Stock actual</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 800, color: '#fff' }}>{producto.stock}</div>
        </div>
        {ajuste !== '' && ajuste !== '0' && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#555', letterSpacing: 1 }}>Resultado</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 36, fontWeight: 800, color: Number(ajuste) > 0 ? '#4ade80' : '#ef4444' }}>
              {nuevoStock}
            </div>
          </div>
        )}
      </div>
      <Campo label="Ajuste (positivo para sumar, negativo para restar)">
        <input
          type="number"
          value={ajuste}
          onChange={(e) => setAjuste(e.target.value)}
          placeholder="ej: +5 o -2"
          autoFocus
          style={inputStyle}
        />
      </Campo>
      <div style={{ fontSize: 11, color: '#555', marginTop: -8, marginBottom: 4 }}>
        El stock no puede quedar por debajo de 0.
      </div>
      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} label="APLICAR AJUSTE" />
    </Modal>
  );
}

// ─── Modal Usuario ────────────────────────────────────────────────────────────
function ModalUsuario({ modo, inicial, onClose, onGuardado, onError }) {
  const [form, setForm] = useState({
    usuario:  inicial.usuario  || '',
    nombre:   inicial.nombre   || '',
    password: '',
    rol:      inicial.rol      || 'cajero',
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar() {
    if (!form.nombre) return onError('El nombre es obligatorio');
    if (modo === 'crear' && (!form.usuario || !form.password)) return onError('Usuario y contraseña son obligatorios');
    setGuardando(true);
    try {
      const url = modo === 'crear' ? '/api/admin/usuarios' : `/api/admin/usuarios/${inicial.usuario}`;
      const method = modo === 'crear' ? 'POST' : 'PUT';
      const body = modo === 'crear'
        ? form
        : { nombre: form.nombre, rol: form.rol, ...(form.password ? { password: form.password } : {}) };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al guardar');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={modo === 'crear' ? 'Nuevo Usuario' : `Editar: ${inicial.nombre}`} onClose={onClose}>
      {modo === 'crear' && (
        <Campo label="Nombre de usuario">
          <input value={form.usuario} onChange={(e) => set('usuario', e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="ej: franco" style={inputStyle} />
        </Campo>
      )}
      <Campo label="Nombre visible">
        <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="ej: Franco" style={inputStyle} />
      </Campo>
      <Campo label={modo === 'editar' ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}>
        <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)}
          placeholder={modo === 'editar' ? 'Nueva contraseña (opcional)' : '••••••••'} style={inputStyle} />
      </Campo>
      <Campo label="Rol">
        <select value={form.rol} onChange={(e) => set('rol', e.target.value)} style={inputStyle}>
          {ROLES.map((r) => <option key={r} value={r}>{r === 'admin' ? 'Admin — acceso a /admin' : 'Cajero — acceso a /caja e /importar'}</option>)}
        </select>
      </Campo>
      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} />
    </Modal>
  );
}

// ─── Modal Márgenes por Categoría ────────────────────────────────────────────
function ModalMargenes({ margenes, onClose, onGuardado, onError }) {
  const [vals, setVals] = useState(
    Object.fromEntries(margenes.map((m) => [m.id, String(m.margen)]))
  );
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      const categorias = CATEGORIAS_LUB.map((c) => ({
        id: c.id,
        margen: Number(vals[c.id] || 40),
      }));
      const res = await fetch('/api/lubricentro/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias }),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al guardar');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title="Márgenes por Categoría" onClose={onClose}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
        El precio de venta se calcula como: <strong style={{ color: '#aaa' }}>costo × (1 + margen%)</strong>
      </div>
      {CATEGORIAS_LUB.map((cat) => (
        <Campo key={cat.id} label={cat.label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min={0}
              max={200}
              value={vals[cat.id] ?? '40'}
              onChange={(e) => setVals((v) => ({ ...v, [cat.id]: e.target.value }))}
              style={{ ...inputStyle, width: 100, textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: '#555' }}>%</span>
            <span style={{ fontSize: 12, color: '#444' }}>
              → venta = costo × {(1 + (Number(vals[cat.id] || 40) / 100)).toFixed(2)}
            </span>
          </div>
        </Campo>
      ))}
      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} label="GUARDAR MÁRGENES" />
    </Modal>
  );
}

// ─── Modal Producto Lubricentro ───────────────────────────────────────────────
function ModalLubricentro({ modo, inicial, margenes, onClose, onGuardado, onError }) {
  const getMargen = (cat) => {
    const m = margenes.find((x) => x.id === cat);
    return m ? Number(m.margen) : 40;
  };

  const [form, setForm] = useState({
    id:           inicial.id           || '',
    codigo:       inicial.codigo       || '',
    nombre:       inicial.nombre       || '',
    categoria:    inicial.categoria    || 'aceites',
    marca:        inicial.marca        || '',
    proveedor:    inicial.proveedor    || '',
    precio_costo: inicial.precio_costo || '',
    precio_lista: inicial.precio_lista || '',
    precio_venta: inicial.precio_venta || '',
    stock:        inicial.stock        || '0',
    alerta_stock: inicial.alerta_stock || '2',
    activo:       inicial.activo       ?? 'true',
  });
  const [guardando, setGuardando] = useState(false);

  const set = (k, v) => setForm((f) => {
    const next = { ...f, [k]: v };
    // Recalcular precio_venta cuando cambia costo o categoría
    if ((k === 'precio_costo' || k === 'categoria') && next.precio_costo) {
      const m = getMargen(next.categoria);
      next.precio_venta = String(Math.ceil(Number(next.precio_costo) * (1 + m / 100)));
    }
    return next;
  });

  const margenCat = getMargen(form.categoria);
  const pvCalculado = form.precio_costo
    ? Math.ceil(Number(form.precio_costo) * (1 + margenCat / 100))
    : 0;

  async function guardar() {
    if (!form.nombre || !form.precio_costo) return onError('Completá nombre y precio de costo');
    if (modo === 'crear' && !form.id) return onError('El ID es obligatorio');
    setGuardando(true);
    try {
      const url = modo === 'crear'
        ? '/api/lubricentro/productos'
        : `/api/lubricentro/productos/${inicial.id}`;
      const method = modo === 'crear' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          margen: margenCat,
          precio_venta: form.precio_venta || pvCalculado,
        }),
      });
      const data = await res.json();
      if (!res.ok) return onError(data.error || 'Error al guardar');
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal title={modo === 'crear' ? 'Nuevo Producto Lubricentro' : `Editar: ${inicial.nombre}`} onClose={onClose}>
      {modo === 'crear' && (
        <Campo label="ID" hint="— letras, números y guiones bajos">
          <input value={form.id} onChange={(e) => set('id', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="ej: motul_5100_1l" style={inputStyle} />
        </Campo>
      )}
      <Campo label="Nombre">
        <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
          placeholder="ej: Motul 5100 4T 15W50 1L" style={inputStyle} />
      </Campo>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Categoría">
          <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} style={inputStyle}>
            {CATEGORIAS_LUB.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Marca">
          <input value={form.marca} onChange={(e) => set('marca', e.target.value)}
            placeholder="ej: Motul" style={inputStyle} />
        </Campo>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Código proveedor">
          <input value={form.codigo} onChange={(e) => set('codigo', e.target.value)}
            placeholder="ej: MOT-5100-1L" style={inputStyle} />
        </Campo>
        <Campo label="Proveedor">
          <input value={form.proveedor} onChange={(e) => set('proveedor', e.target.value)}
            placeholder="ej: fusion" style={inputStyle} />
        </Campo>
      </div>

      {/* Precios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Precio costo ($)">
          <input type="number" value={form.precio_costo} onChange={(e) => set('precio_costo', e.target.value)}
            placeholder="0" style={inputStyle} />
        </Campo>
        <Campo label="Precio lista sugerido ($)" hint="opcional">
          <input type="number" value={form.precio_lista} onChange={(e) => set('precio_lista', e.target.value)}
            placeholder="0" style={inputStyle} />
        </Campo>
      </div>

      {/* Precio venta calculado */}
      <div style={{ background: '#0f0f0f', borderRadius: 10, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1 }}>PRECIO VENTA (margen {margenCat}%)</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 800, color: '#3b82f6' }}>
            ${pvCalculado.toLocaleString('es-AR')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>Ajustar manualmente</div>
          <input
            type="number"
            value={form.precio_venta}
            onChange={(e) => setForm((f) => ({ ...f, precio_venta: e.target.value }))}
            placeholder={String(pvCalculado)}
            style={{ ...inputStyle, width: 120, textAlign: 'right' }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Campo label="Stock">
          <input type="number" value={form.stock} onChange={(e) => set('stock', e.target.value)}
            placeholder="0" style={inputStyle} />
        </Campo>
        <Campo label="Alerta stock mínimo">
          <input type="number" value={form.alerta_stock} onChange={(e) => set('alerta_stock', e.target.value)}
            placeholder="2" style={inputStyle} />
        </Campo>
      </div>

      <BotonesModal onClose={onClose} onGuardar={guardar} guardando={guardando} />
    </Modal>
  );
}
