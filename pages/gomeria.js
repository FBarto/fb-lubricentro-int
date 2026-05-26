import { useState, useEffect } from "react";

const GRUPOS = ["Autos", "Motos", "Camionetas", "Otros"];

const GRUPO_COLORS = {
  Autos: { bg: "#1a2744", accent: "#3b82f6", light: "#dbeafe" },
  Motos: { bg: "#1a1a2e", accent: "#8b5cf6", light: "#ede9fe" },
  Camionetas: { bg: "#1a2e1a", accent: "#22c55e", light: "#dcfce7" },
  Otros: { bg: "#2e1a1a", accent: "#f97316", light: "#ffedd5" },
};

export default function Gomeria() {
  const [servicios, setServicios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [grupoActivo, setGrupoActivo] = useState("Autos");
  const [showPanel, setShowPanel] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [esEfectivo, setEsEfectivo] = useState(false);
  const [autocompleteResult, setAutocompleteResult] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [datosExpandidos, setDatosExpandidos] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/gomeria/servicios').then(r => r.json()),
      fetch('/api/gomeria/productos').then(r => r.json()),
    ]).then(([svcs, prods]) => {
      if (Array.isArray(svcs)) setServicios(svcs);
      if (Array.isArray(prods)) setProductos(prods);
    }).catch(() => setError("Error al cargar datos."))
      .finally(() => setCargando(false));
  }, []);

  // Autocomplete por patente
  useEffect(() => {
    if (!patente || patente.trim().length < 3) { setAutocompleteResult(null); return; }
    const timer = setTimeout(async () => {
      setBuscandoCliente(true);
      try {
        const res = await fetch(`/api/gomeria/cliente?patente=${encodeURIComponent(patente.trim())}`);
        const data = await res.json();
        setAutocompleteResult(data.found ? data : null);
      } catch { setAutocompleteResult(null); }
      finally { setBuscandoCliente(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [patente]);

  const aplicarAutocomplete = () => {
    if (!autocompleteResult) return;
    if (autocompleteResult.marca) setMarca(autocompleteResult.marca);
    if (autocompleteResult.modelo) setModelo(autocompleteResult.modelo);
    if (autocompleteResult.cliente) setClienteNombre(autocompleteResult.cliente);
    if (autocompleteResult.telefono) setTelefono(autocompleteResult.telefono);
    setDatosExpandidos(true);
    setAutocompleteResult(null);
  };

  const agregarServicio = (s) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.id === s.id);
      if (ex) return prev.map(i => i.id === s.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...s, tipo: 'servicio', cantidad: 1 }];
    });
  };

  const agregarProducto = (p) => {
    const pid = 'prod_' + p.id;
    setCarrito(prev => {
      const ex = prev.find(i => i.id === pid);
      if (ex) return prev.map(i => i.id === pid ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...p, id: pid, tipo: 'producto', cantidad: 1 }];
    });
    setShowPanel(false);
  };

  const quitar = (id) => {
    setCarrito(prev => {
      const ex = prev.find(i => i.id === id);
      if (!ex) return prev;
      if (ex.cantidad === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const getPrecio = (item) => {
    if (item.tipo === 'producto' && esEfectivo && item.precio_efectivo > 0) return item.precio_efectivo;
    return item.precio;
  };

  const total = carrito.reduce((s, i) => s + getPrecio(i) * i.cantidad, 0);
  const prodEnCarrito = carrito.filter(i => i.tipo === 'producto').length;

  const abrirModal = () => { if (carrito.length === 0) return; setShowModal(true); setError(""); setDatosExpandidos(false); setAutocompleteResult(null); };

  const enviarACaja = async () => {
    setShowModal(false);
    setEnviando(true);
    setError("");
    try {
      const itemsConPrecio = carrito.map(i => ({ ...i, precio: getPrecio(i), label: i.label || i.nombre }));
      const res = await fetch('/api/gomeria/orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsConPrecio, cliente_nombre: clienteNombre, patente, marca, modelo, telefono, es_efectivo: esEfectivo }),
      });
      if (!res.ok) throw new Error('Error al enviar');

      // Descontar stock de productos
      for (const item of carrito.filter(i => i.tipo === 'producto')) {
        const prodId = item.id.replace('prod_', '');
        await fetch(`/api/gomeria/stock/${prodId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: prodId, cantidad: item.cantidad }),
        });
      }

      setEnviado(true);
      setTimeout(() => {
        setEnviado(false);
        setCarrito([]);
        setClienteNombre(""); setPatente(""); setMarca(""); setModelo(""); setTelefono(""); setEsEfectivo(false); setDatosExpandidos(false); setAutocompleteResult(null);
        // Recargar productos para stock actualizado
        fetch('/api/gomeria/productos').then(r => r.json()).then(data => { if (Array.isArray(data)) setProductos(data); });
      }, 2500);
    } catch {
      setError("No se pudo enviar. Verificá la conexión.");
    } finally {
      setEnviando(false);
    }
  };

  const serviciosDelGrupo = servicios.filter(s => s.grupo === grupoActivo);
  const colores = GRUPO_COLORS[grupoActivo];

  if (cargando) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid #222", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, color: "#555", letterSpacing: 2 }}>CARGANDO...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: "'Barlow Condensed', Arial, sans-serif", display: "flex", flexDirection: "column", userSelect: "none", position: "relative" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn-svc:active { transform: scale(0.95); }
        .btn-prod:active { transform: scale(0.95); }
        @keyframes popIn { 0% { transform: scale(0.5); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .qty-badge { animation: popIn 0.15s ease-out; }
        @keyframes checkmark { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        .check-anim { animation: checkmark 0.4s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .slide-up { animation: slideUp 0.25s ease-out; }
        @keyframes fabPulse { 0%,100%{box-shadow:0 4px 16px #f9731666} 50%{box-shadow:0 4px 28px #f97316aa} }
        .fab-anim { animation: fabPulse 2s infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ac-btn:active { transform: scale(0.97); }
        .toggle-datos:active { background: #1e1e1e !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "2px solid #222", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>FB LUBRICENTRO</div>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 3, textTransform: "uppercase" }}>Gomería · AntiGravity</div>
        </div>
        <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 2 }}>TURNO</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Servicios */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tabs grupos */}
          <div style={{ display: "flex", background: "#111", borderBottom: "1px solid #222", padding: "8px 10px 0", gap: 5 }}>
            {GRUPOS.map(g => {
              const c = GRUPO_COLORS[g], act = g === grupoActivo;
              const cnt = carrito.filter(i => i.grupo === g).reduce((s, i) => s + i.cantidad, 0);
              return (
                <button key={g} onClick={() => setGrupoActivo(g)}
                  style={{ flex: 1, padding: "9px 4px", border: "none", borderRadius: "7px 7px 0 0", background: act ? c.bg : "#1a1a1a", color: act ? c.light : "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, cursor: "pointer", position: "relative", borderBottom: `3px solid ${act ? c.accent : "transparent"}` }}>
                  {g}
                  {cnt > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: c.accent, color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{cnt}</span>}
                </button>
              );
            })}
          </div>

          {/* Grid servicios */}
          <div style={{ flex: 1, padding: 10, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, alignContent: "start", background: colores.bg + "55", overflowY: "auto" }}>
            {serviciosDelGrupo.map(s => {
              const en = carrito.find(i => i.id === s.id);
              return (
                <button key={s.id} className="btn-svc" onClick={() => agregarServicio(s)}
                  style={{ background: en ? colores.bg : "#1a1a1a", border: `2px solid ${en ? colores.accent : "#2a2a2a"}`, borderRadius: 14, padding: "16px 10px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", boxShadow: en ? `0 0 18px ${colores.accent}33` : "none", transition: "all 0.15s" }}>
                  {en && <span className="qty-badge" key={en.cantidad} style={{ position: "absolute", top: 7, right: 7, background: colores.accent, color: "#fff", borderRadius: "50%", width: 22, height: 22, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{en.cantidad}</span>}
                  <span style={{ fontSize: 30 }}>{s.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: en ? colores.light : "#ccc", textAlign: "center", lineHeight: 1.2 }}>{s.label}</span>
                  <span style={{ fontSize: 12, color: en ? colores.accent : "#444", fontWeight: 600 }}>${s.precio.toLocaleString("es-AR")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Carrito */}
        <div style={{ width: 220, background: "#111", borderLeft: "1px solid #222", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #222", fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>Orden Actual</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {carrito.length === 0
              ? <div style={{ textAlign: "center", color: "#333", fontSize: 12, padding: "24px 8px" }}>Seleccioná servicios o productos</div>
              : carrito.map(item => {
                  const esProd = item.tipo === 'producto';
                  const accentColor = esProd ? "#f97316" : (GRUPO_COLORS[item.grupo]?.accent || "#3b82f6");
                  const precioFinal = getPrecio(item);
                  return (
                    <div key={item.id} style={{ background: "#1a1a1a", borderRadius: 9, padding: "8px", marginBottom: 6, borderLeft: `3px solid ${accentColor}`, display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0", lineHeight: 1.2 }}>{item.icon} {item.label || item.nombre}</div>
                        {esProd && item.medida && item.medida !== '—' && <div style={{ fontSize: 10, color: "#555" }}>{item.marca} · {item.medida}</div>}
                        <div style={{ fontSize: 10, color: "#555" }}>${precioFinal.toLocaleString()} × {item.cantidad}</div>
                        <div style={{ fontSize: 12, color: accentColor, fontWeight: 700 }}>${(precioFinal * item.cantidad).toLocaleString("es-AR")}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <button onClick={() => esProd ? agregarProducto({...item, id: item.id.replace('prod_','')}) : agregarServicio(item)} style={{ width: 22, height: 22, background: "#2a2a2a", border: `1px solid ${accentColor}55`, borderRadius: 5, color: accentColor, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                        <button onClick={() => quitar(item.id)} style={{ width: 22, height: 22, background: "#2a2a2a", border: "1px solid #333", borderRadius: 5, color: "#666", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                      </div>
                    </div>
                  );
                })}
          </div>
          <div style={{ padding: "10px 12px", borderTop: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase" }}>Total</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, color: "#fff" }}>${total.toLocaleString("es-AR")}</span>
            </div>
            {error && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 6, textAlign: "center" }}>{error}</div>}
            <button onClick={abrirModal} disabled={carrito.length === 0 || enviando}
              style={{ width: "100%", padding: "13px", background: enviado ? "#16a34a" : carrito.length === 0 ? "#1a1a1a" : "#2563eb", border: "none", borderRadius: 10, color: carrito.length === 0 ? "#333" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: 1, cursor: carrito.length === 0 ? "not-allowed" : "pointer", transition: "background 0.3s" }}>
              {enviado ? <span className="check-anim">✓ ENVIADO A CAJA</span> : enviando ? "Enviando..." : "📤 ENVIAR A CAJA"}
            </button>
          </div>
        </div>
      </div>

      {/* FAB — botón flotante productos */}
      <button
        className={prodEnCarrito > 0 ? "" : "fab-anim"}
        onClick={() => setShowPanel(true)}
        style={{ position: "fixed", bottom: 24, left: "calc(50% - 120px)", background: "#f97316", border: "none", borderRadius: 50, padding: "12px 20px", color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, zIndex: 50, boxShadow: "0 4px 20px #f9731666" }}>
        📦 PRODUCTOS
        {prodEnCarrito > 0 && <span style={{ background: "#fff", color: "#f97316", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{prodEnCarrito}</span>}
      </button>

      {/* Panel de productos */}
      {showPanel && (
        <div onClick={() => setShowPanel(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div className="slide-up" onClick={e => e.stopPropagation()}
            style={{ background: "#111", borderRadius: "16px 16px 0 0", borderTop: "2px solid #f97316", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, color: "#f97316", letterSpacing: 1 }}>📦 PRODUCTOS</div>
              <button onClick={() => setShowPanel(false)} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, width: 30, height: 30, color: "#666", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {productos.map(p => {
                const stockBajo = p.stock <= p.alerta_stock;
                const enCarrito = carrito.find(i => i.id === 'prod_' + p.id);
                return (
                  <button key={p.id} className="btn-prod" onClick={() => agregarProducto(p)}
                    style={{ background: stockBajo ? "#1a0a0a" : "#1a1a0a", border: `2px solid ${stockBajo ? "#ef444466" : enCarrito ? "#f97316" : "#f9731633"}`, borderRadius: 10, padding: "10px 6px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative", boxShadow: enCarrito ? "0 0 12px #f9731633" : "none", transition: "all 0.15s" }}>
                    {enCarrito && <span style={{ position: "absolute", top: 5, right: 5, background: "#f97316", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{enCarrito.cantidad}</span>}
                    <span style={{ fontSize: stockBajo ? 9 : 9, background: stockBajo ? "#ef444422" : "#16a34a22", color: stockBajo ? "#f87171" : "#4ade80", padding: "1px 6px", borderRadius: 4, fontFamily: "'Barlow',sans-serif" }}>
                      {stockBajo ? `⚠️ Stock: ${p.stock}` : `Stock: ${p.stock}`}
                    </span>
                    <span style={{ fontSize: 24 }}>{p.icon}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: stockBajo ? "#fca5a5" : "#fed7aa", textAlign: "center", lineHeight: 1.2 }}>{p.nombre}</span>
                    {p.marca && p.marca !== '—' && <span style={{ fontSize: 9, color: "#666" }}>{p.marca}</span>}
                    {p.medida && p.medida !== '—' && <span style={{ fontSize: 9, color: "#555" }}>{p.medida}</span>}
                    <span style={{ fontSize: 12, color: stockBajo ? "#ef4444" : "#f97316", fontWeight: 700 }}>${p.precio.toLocaleString("es-AR")}</span>
                    {p.precio_efectivo > 0 && <span style={{ fontSize: 10, color: "#4ade80" }}>💵 ${p.precio_efectivo.toLocaleString("es-AR")}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal datos vehículo — rediseñado Sprint 3 */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 70, padding: 16 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 20, width: "100%", maxWidth: 420, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 22px 14px", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>Datos del vehículo</div>
              <button onClick={() => setShowModal(false)} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 10, width: 38, height: 38, color: "#666", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Resumen orden */}
              <div style={{ background: "#1a1a1a", borderRadius: 12, padding: "12px 16px", borderLeft: "3px solid #2563eb" }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 4, lineHeight: 1.5 }}>
                  {carrito.map(i => `${i.icon || ''} ${i.label || i.nombre}${i.cantidad > 1 ? ` ×${i.cantidad}` : ''}`).join('  ·  ')}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800, color: "#fff" }}>
                  ${total.toLocaleString("es-AR")}
                </div>
              </div>

              {/* Forma de cobro */}
              <div>
                <div style={{ fontSize: 11, color: "#555", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10 }}>Forma de cobro</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button onClick={() => setEsEfectivo(true)} className="ac-btn"
                    style={{ padding: "18px", border: `2px solid ${esEfectivo ? "#16a34a" : "#222"}`, borderRadius: 14, background: esEfectivo ? "#16a34a22" : "#1a1a1a", color: esEfectivo ? "#4ade80" : "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, fontWeight: 800, cursor: "pointer", transition: "all 0.15s" }}>
                    💵 EFECTIVO
                  </button>
                  <button onClick={() => setEsEfectivo(false)} className="ac-btn"
                    style={{ padding: "18px", border: `2px solid ${!esEfectivo ? "#3b82f6" : "#222"}`, borderRadius: 14, background: !esEfectivo ? "#0f1f40" : "#1a1a1a", color: !esEfectivo ? "#93c5fd" : "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 19, fontWeight: 800, cursor: "pointer", transition: "all 0.15s" }}>
                    💳 OTRO
                  </button>
                </div>
              </div>

              {/* Patente con autocomplete */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#555", letterSpacing: 3, textTransform: "uppercase" }}>Patente</div>
                  <div style={{ fontSize: 11, color: "#2a2a2a", fontStyle: "italic" }}>opcional</div>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="ABC 123"
                    value={patente}
                    onChange={e => setPatente(e.target.value.toUpperCase())}
                    autoFocus
                    style={{ width: "100%", background: "#0d1b33", border: `2px solid ${patente.length >= 3 ? "#3b82f6" : "#3b82f633"}`, borderRadius: 14, padding: "18px 20px", color: "#93c5fd", fontSize: 36, fontWeight: 800, letterSpacing: 6, textAlign: "center", outline: "none", fontFamily: "'Barlow Condensed',sans-serif", transition: "border-color 0.2s" }}
                  />
                  {buscandoCliente && (
                    <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, border: "2px solid #3b82f633", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                  )}
                </div>

                {/* Sugerencia autocomplete */}
                {autocompleteResult && (
                  <div style={{ marginTop: 10, background: "#0a1628", border: "1px solid #3b82f640", borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: 1, marginBottom: 5 }}>🚗 Cliente anterior encontrado</div>
                        {(autocompleteResult.marca || autocompleteResult.modelo) && (
                          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                            {[autocompleteResult.marca, autocompleteResult.modelo].filter(Boolean).join(' ')}
                          </div>
                        )}
                        {autocompleteResult.cliente && <div style={{ fontSize: 14, color: "#888" }}>{autocompleteResult.cliente}</div>}
                        {autocompleteResult.telefono && <div style={{ fontSize: 12, color: "#555" }}>{autocompleteResult.telefono}</div>}
                      </div>
                      <button onClick={aplicarAutocomplete} className="ac-btn"
                        style={{ background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 16px", color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0, letterSpacing: 0.5, transition: "all 0.15s" }}>
                        USAR ✓
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Datos del cliente — colapsable */}
              <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 16 }}>
                <button
                  onClick={() => setDatosExpandidos(s => !s)}
                  className="toggle-datos"
                  style={{ background: "none", border: "1px solid #222", borderRadius: 12, padding: "14px 16px", color: datosExpandidos ? "#ccc" : "#555", width: "100%", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }}
                >
                  <span style={{ letterSpacing: 0.5 }}>
                    {datosExpandidos ? "▾" : "▸"} Datos del cliente
                    <span style={{ fontSize: 11, color: "#333", marginLeft: 8, fontWeight: 400 }}>opcional</span>
                  </span>
                  {(marca || modelo || clienteNombre || telefono) && (
                    <span style={{ background: "#1e1e1e", color: "#666", borderRadius: 20, padding: "3px 10px", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[marca, modelo, clienteNombre].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>

                {datosExpandidos && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Marca</div>
                        <input type="text" placeholder="Ford" value={marca} onChange={e => setMarca(e.target.value)}
                          style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px", color: "#ccc", fontSize: 16, outline: "none", minHeight: 52 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Modelo</div>
                        <input type="text" placeholder="Focus" value={modelo} onChange={e => setModelo(e.target.value)}
                          style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px", color: "#ccc", fontSize: 16, outline: "none", minHeight: 52 }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Nombre del cliente</div>
                      <input type="text" placeholder="Juan García" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)}
                        style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px", color: "#ccc", fontSize: 16, outline: "none", minHeight: 52 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Teléfono</div>
                      <input type="tel" placeholder="3516 000000" value={telefono} onChange={e => setTelefono(e.target.value)}
                        style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, padding: "14px", color: "#ccc", fontSize: 16, outline: "none", minHeight: 52 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones */}
              <div style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: "17px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 14, color: "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={enviarACaja} className="ac-btn"
                  style={{ flex: 2, padding: "17px", background: "#2563eb", border: "none", borderRadius: 14, color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 21, fontWeight: 800, letterSpacing: 1, cursor: "pointer", transition: "all 0.15s" }}>
                  📤 ENVIAR A CAJA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
