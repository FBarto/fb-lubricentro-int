import { useState, useEffect } from "react";

const PRODUCTOS_LOCALES = [
  { id: "P001", codigo: "ACE001", nombre: "Aceite 10W40 1L", categoria: "Aceites", precio: 4200 },
  { id: "P002", codigo: "ACE002", nombre: "Aceite 15W40 4L", categoria: "Aceites", precio: 15800 },
  { id: "P003", codigo: "FIL001", nombre: "Filtro de Aceite Universal", categoria: "Filtros", precio: 3100 },
  { id: "P004", codigo: "FIL002", nombre: "Filtro de Aire Ford Ka", categoria: "Filtros", precio: 2800 },
  { id: "P005", codigo: "BAT001", nombre: "Batería 12V 60Ah", categoria: "Baterías", precio: 42000 },
  { id: "P006", codigo: "BAT002", nombre: "Batería 12V 75Ah", categoria: "Baterías", precio: 56000 },
  { id: "P007", codigo: "ADI001", nombre: "Aditivo Limpiacarbón", categoria: "Aditivos", precio: 2200 },
  { id: "P008", codigo: "LUB001", nombre: "Grasa Multipropósito", categoria: "Lubricantes", precio: 1800 },
];

const CATEGORIAS = ["Todos", "Aceites", "Filtros", "Baterías", "Aditivos", "Lubricantes"];

const FORMAS_PAGO = [
  { id: "efectivo", label: "Efectivo", icon: "💵" },
  { id: "transferencia", label: "Transferencia", icon: "📱" },
  { id: "debito", label: "Débito", icon: "💳" },
  { id: "credito", label: "Crédito", icon: "💰" },
  { id: "qr", label: "QR / MP", icon: "⬜" },
];

const MARKETING = ["Google Ads", "Facebook", "Recomendación", "Paso por la calle", "Otro"];

const totalOrden = (items) =>
  (items || []).reduce((s, i) => s + Number(i.precio) * Number(i.cantidad), 0);

export default function Caja() {
  const [tab, setTab] = useState("pendientes");
  const [pendientes, setPendientes] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [formaPago, setFormaPago] = useState("");
  const [clienteCobro, setClienteCobro] = useState("");
  const [marketing, setMarketing] = useState("");
  const [cobrandoId, setCobrandoId] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todos");
  const [productos, setProductos] = useState(PRODUCTOS_LOCALES);
  const [carritoLocal, setCarritoLocal] = useState([]);
  const [clienteLocal, setClienteLocal] = useState("");
  const [marketingLocal, setMarketingLocal] = useState("");
  const [formaPagoLocal, setFormaPagoLocal] = useState("");
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Polling de pendientes cada 5 seg
  const fetchPendientes = async () => {
    try {
      const res = await fetch('/api/caja/pendientes');
      if (res.ok) {
        const data = await res.json();
        setPendientes(data);
        // Actualizar ordenSeleccionada si sigue pendiente (para mostrar datos nuevos)
        setOrdenSeleccionada((prev) => {
          if (!prev) return prev;
          const updated = data.find((o) => o.id === prev.id);
          return updated || prev;
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchPendientes();
    const interval = setInterval(fetchPendientes, 5000);
    return () => clearInterval(interval);
  }, []);

  // Buscar productos en API (con fallback local)
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (busqueda) params.set('q', busqueda);
        if (categoriaFiltro !== 'Todos') params.set('categoria', categoriaFiltro);
        const res = await fetch(`/api/productos?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (data.length > 0) setProductos(data);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [busqueda, categoriaFiltro]);

  const cobrarOrden = async () => {
    if (!formaPago || !ordenSeleccionada) return;
    setCobrandoId(ordenSeleccionada.id);
    try {
      const res = await fetch(`/api/caja/cobrar/${ordenSeleccionada.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forma_pago: formaPago, cliente: clienteCobro, marketing }),
      });
      if (res.ok) {
        setHistorial((prev) => [...prev, { ...ordenSeleccionada, estado: 'cobrado', forma_pago: formaPago, cliente: clienteCobro || ordenSeleccionada.cliente, marketing, hora_cobro: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }]);
        setPendientes((prev) => prev.filter((o) => o.id !== ordenSeleccionada.id));
        setOrdenSeleccionada(null);
        setFormaPago("");
        setClienteCobro("");
        setMarketing("");
      }
    } finally {
      setCobrandoId(null);
    }
  };

  const agregarProducto = (prod) => {
    setCarritoLocal((prev) => {
      const existe = prev.find((i) => i.id === prod.id);
      if (existe) return prev.map((i) => i.id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...prod, cantidad: 1 }];
    });
  };

  const quitarProducto = (id) => {
    setCarritoLocal((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item.cantidad === 1) return prev.filter((i) => i.id !== id);
      return prev.map((i) => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const registrarVentaLocal = async () => {
    if (carritoLocal.length === 0 || !formaPagoLocal) return;
    setCargando(true);
    try {
      const res = await fetch('/api/caja/venta-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: carritoLocal.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })), forma_pago: formaPagoLocal, cliente: clienteLocal, marketing: marketingLocal }),
      });
      if (res.ok) {
        setVentaExitosa(true);
        const nueva = { id: `local-${Date.now()}`, origen: 'caja', estado: 'cobrado', hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), hora_cobro: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }), cliente: clienteLocal, forma_pago: formaPagoLocal, marketing: marketingLocal, items: carritoLocal.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, precio: i.precio })) };
        setHistorial((prev) => [...prev, nueva]);
        setTimeout(() => { setVentaExitosa(false); setCarritoLocal([]); setClienteLocal(""); setMarketingLocal(""); setFormaPagoLocal(""); }, 2000);
      }
    } finally {
      setCargando(false);
    }
  };

  const totalLocal = carritoLocal.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const productosFiltrados = productos.filter((p) => {
    const matchCat = categoriaFiltro === "Todos" || p.categoria === categoriaFiltro;
    const matchBusq = busqueda === "" || p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || p.codigo?.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter','Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#111} ::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        input:focus{outline:none;border-color:#3b82f6!important}
        .row-orden:hover{background:#161616!important;cursor:pointer}
        .prod-btn:hover{background:#1e1e1e!important;border-color:#333!important}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fadeIn 0.2s ease-out}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .pulsing{animation:pulse 1.5s infinite}
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>FB LUBRICENTRO</div>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3 }}>CAJA · ANTIGRAVITY</div>
          </div>
          <div style={{ width: 1, height: 32, background: "#222" }} />
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "pendientes", label: "Pendientes", badge: pendientes.length }, { id: "nueva", label: "Nueva Venta" }, { id: "historial", label: "Historial" }].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: tab === t.id ? "#1d4ed8" : "transparent", color: tab === t.id ? "#fff" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}>
                {t.label}
                {t.badge > 0 && <span className="pulsing" style={{ background: "#ef4444", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700 }}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#444" }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 700, color: "#fff" }}>{new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>

      {/* Tab Pendientes */}
      {tab === "pendientes" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 380, borderRight: "1px solid #1a1a1a", overflowY: "auto" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a", fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>{pendientes.length} cobros pendientes</div>
            {pendientes.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#333", fontSize: 14 }}>Sin órdenes pendientes</div>}
            {pendientes.map((o) => {
              const tot = totalOrden(o.items);
              const sel = ordenSeleccionada?.id === o.id;
              return (
                <div key={o.id} className="row-orden" onClick={() => { setOrdenSeleccionada(o); setFormaPago(""); setClienteCobro(""); setMarketing(""); }}
                  style={{ padding: "14px 16px", borderBottom: "1px solid #141414", background: sel ? "#0f1f40" : "transparent", borderLeft: sel ? "3px solid #3b82f6" : "3px solid transparent", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", background: "#1d4ed8", padding: "2px 10px", borderRadius: 5 }}>🔧 GOMERÍA</span>
                      <span style={{ fontSize: 11, color: "#555" }}>{o.hora}</span>
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#3b82f6" }}>${tot.toLocaleString("es-AR")}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#ccc", fontWeight: 500, marginBottom: 5, lineHeight: 1.5 }}>
                    {(o.items || []).map((i) => {
                      const nombre = i.nombre || i.nombre_item || "Servicio";
                      const cant = Number(i.cantidad) || 1;
                      return cant > 1 ? `${nombre} ×${cant}` : nombre;
                    }).join("  ·  ")}
                  </div>
                  {o.patente && (
                    <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#1a2744", color: "#93c5fd", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, padding: "2px 10px", borderRadius: 5 }}>🚗 {o.patente}</span>
                      {(o.marca || o.modelo) && <span style={{ fontSize: 11, color: "#555" }}>{[o.marca, o.modelo].filter(Boolean).join(' ')}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: o.cliente ? "#3b82f6" : "#333" }}>
                      {o.cliente ? `👤 ${o.cliente}` : "Sin nombre"}
                      {o.telefono ? ` · 📞 ${o.telefono}` : ""}
                    </span>
                    <span style={{ fontSize: 11, color: "#444" }}>{(o.items||[]).length} servicio{(o.items||[]).length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {!ordenSeleccionada
              ? <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#2a2a2a", fontSize: 15 }}>← Seleccioná una orden para cobrar</div>
              : (
                <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>Orden de Gomería</div>
                        {ordenSeleccionada.patente && <span style={{ background: "#1a2744", color: "#93c5fd", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, letterSpacing: 2, padding: "3px 12px", borderRadius: 6 }}>{ordenSeleccionada.patente}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
                        {ordenSeleccionada.hora}
                        {ordenSeleccionada.marca || ordenSeleccionada.modelo ? ` · ${[ordenSeleccionada.marca, ordenSeleccionada.modelo].filter(Boolean).join(' ')}` : ""}
                        {ordenSeleccionada.cliente ? ` · 👤 ${ordenSeleccionada.cliente}` : ""}
                        {ordenSeleccionada.telefono ? ` · 📞 ${ordenSeleccionada.telefono}` : ""}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 38, fontWeight: 800, color: "#fff" }}>${totalOrden(ordenSeleccionada.items).toLocaleString("es-AR")}</div>
                  </div>
                  <div style={{ background: "#111", borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
                    {(ordenSeleccionada.items || []).map((item, i) => (
                      <div key={i} style={{ padding: "12px 16px", borderBottom: i < ordenSeleccionada.items.length - 1 ? "1px solid #1a1a1a" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14, color: "#ddd", fontWeight: 500 }}>{item.nombre || item.nombre_item || "Servicio"}</div>
                          <div style={{ fontSize: 12, color: "#555" }}>${Number(item.precio || item.precio_unitario || 0).toLocaleString("es-AR")} × {item.cantidad}</div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>${(Number(item.precio || item.precio_unitario || 0) * Number(item.cantidad)).toLocaleString("es-AR")}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Cliente</label>
                    <input type="text" value={clienteCobro} onChange={(e) => setClienteCobro(e.target.value)} placeholder={ordenSeleccionada.cliente || "Nombre (opcional)"}
                      style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, padding: "9px 12px", color: "#ccc", fontSize: 14 }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>¿Cómo nos conoció?</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {MARKETING.map((m) => (
                        <button key={m} onClick={() => setMarketing(m === marketing ? "" : m)}
                          style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${marketing === m ? "#3b82f6" : "#222"}`, background: marketing === m ? "#1d4ed8" : "#111", color: marketing === m ? "#fff" : "#666", fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}>{m}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Forma de Pago *</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
                      {FORMAS_PAGO.map((fp) => (
                        <button key={fp.id} onClick={() => setFormaPago(fp.id)}
                          style={{ padding: "12px 8px", borderRadius: 8, border: `2px solid ${formaPago === fp.id ? "#3b82f6" : "#1e1e1e"}`, background: formaPago === fp.id ? "#0f1f40" : "#111", color: formaPago === fp.id ? "#93c5fd" : "#555", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{fp.icon}</div>{fp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }} />
                  <button onClick={cobrarOrden} disabled={!formaPago || cobrandoId === ordenSeleccionada.id}
                    style={{ padding: "16px", background: !formaPago ? "#1a1a1a" : "#16a34a", border: "none", borderRadius: 10, color: !formaPago ? "#333" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, letterSpacing: 1, cursor: !formaPago ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
                    {cobrandoId === ordenSeleccionada.id ? "Registrando..." : formaPago ? `✓ COBRAR $${totalOrden(ordenSeleccionada.items).toLocaleString("es-AR")}` : "Seleccioná forma de pago"}
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Tab Nueva Venta */}
      {tab === "nueva" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a1a1a" }}>
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o código..."
                style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 8, padding: "8px 12px", color: "#ccc", fontSize: 14 }} />
            </div>
            <div style={{ padding: "8px 16px", borderBottom: "1px solid #1a1a1a", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIAS.map((c) => (
                <button key={c} onClick={() => setCategoriaFiltro(c)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: categoriaFiltro === c ? "#1d4ed8" : "#1a1a1a", color: categoriaFiltro === c ? "#fff" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{c}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, alignContent: "start" }}>
              {productosFiltrados.map((p) => {
                const enCarrito = carritoLocal.find((i) => i.id === p.id);
                const altCodes = p.cod_alternativo ? p.cod_alternativo.split(" | ").filter(Boolean) : [];
                return (
                  <button key={p.id} className="prod-btn" onClick={() => agregarProducto(p)}
                    style={{ background: enCarrito ? "#0f1f40" : "#111", border: `1px solid ${enCarrito ? "#3b82f6" : "#1e1e1e"}`, borderRadius: 10, padding: "12px", cursor: "pointer", textAlign: "left", position: "relative", transition: "all 0.15s" }}>
                    {enCarrito && <span style={{ position: "absolute", top: 8, right: 8, background: "#3b82f6", color: "#fff", borderRadius: "50%", width: 22, height: 22, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{enCarrito.cantidad}</span>}
                    {/* Código principal */}
                    {p.codigo && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                        <span style={{ fontSize: 9, color: "#555", letterSpacing: 1, textTransform: "uppercase" }}>Código</span>
                        <span style={{ fontSize: 11, color: "#888", fontFamily: "monospace", background: "#1a1a1a", padding: "1px 6px", borderRadius: 4 }}>{p.codigo}</span>
                      </div>
                    )}
                    {/* Nombre */}
                    <div style={{ fontSize: 13, fontWeight: 600, color: enCarrito ? "#93c5fd" : "#ccc", marginBottom: 6, lineHeight: 1.3 }}>{p.nombre}</div>
                    {/* Categoría */}
                    {p.categoria && (
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ background: "#1a1a1a", padding: "2px 7px", borderRadius: 4, color: "#666" }}>{p.categoria}</span>
                      </div>
                    )}
                    {/* Códigos alternativos */}
                    {altCodes.length > 0 && (
                      <div style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {altCodes.slice(0, 4).map((ac, i) => {
                          const [marca, cod] = ac.split(":");
                          return cod ? (
                            <span key={i} style={{ fontSize: 9, background: "#1a1a2e", color: "#8b5cf6", padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>
                              {marca}: {cod}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {/* Precio */}
                    <div style={{ fontSize: 18, fontWeight: 700, color: enCarrito ? "#3b82f6" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", marginTop: 4 }}>
                      ${Number(p.precio).toLocaleString("es-AR")}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ width: 280, borderLeft: "1px solid #1a1a1a", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a1a1a", fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>Venta Local</div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
              {carritoLocal.length === 0
                ? <div style={{ textAlign: "center", color: "#2a2a2a", fontSize: 13, padding: "30px 10px" }}>Seleccioná productos</div>
                : carritoLocal.map((item) => (
                  <div key={item.id} style={{ background: "#111", borderRadius: 8, padding: 10, marginBottom: 8, borderLeft: "3px solid #3b82f6" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ddd", marginBottom: 3 }}>{item.nombre}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: "#555" }}>${item.precio.toLocaleString()} ×{item.cantidad}</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => agregarProducto(item)} style={{ width: 22, height: 22, background: "#1a1a1a", border: "1px solid #3b82f655", borderRadius: 4, color: "#3b82f6", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                        <button onClick={() => quitarProducto(item.id)} style={{ width: 22, height: 22, background: "#1a1a1a", border: "1px solid #333", borderRadius: 4, color: "#555", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", marginTop: 2, fontFamily: "'Barlow Condensed',sans-serif" }}>${(item.precio * item.cantidad).toLocaleString("es-AR")}</div>
                  </div>
                ))}
            </div>
            <div style={{ padding: "12px 14px", borderTop: "1px solid #1a1a1a" }}>
              <input type="text" value={clienteLocal} onChange={(e) => setClienteLocal(e.target.value)} placeholder="Cliente (opcional)"
                style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 7, padding: "7px 10px", color: "#ccc", fontSize: 13, marginBottom: 8 }} />
              <select value={marketingLocal} onChange={(e) => setMarketingLocal(e.target.value)}
                style={{ width: "100%", background: "#111", border: "1px solid #1e1e1e", borderRadius: 7, padding: "7px 10px", color: marketingLocal ? "#ccc" : "#444", fontSize: 13, marginBottom: 10 }}>
                <option value="">¿Cómo nos conoció?</option>
                {MARKETING.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                {FORMAS_PAGO.map((fp) => (
                  <button key={fp.id} onClick={() => setFormaPagoLocal(fp.id)}
                    style={{ padding: "8px 4px", borderRadius: 7, border: `1px solid ${formaPagoLocal === fp.id ? "#3b82f6" : "#1e1e1e"}`, background: formaPagoLocal === fp.id ? "#0f1f40" : "#111", color: formaPagoLocal === fp.id ? "#93c5fd" : "#555", fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
                    {fp.icon} {fp.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ color: "#555", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Total</span>
                <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 800, color: "#fff" }}>${totalLocal.toLocaleString("es-AR")}</span>
              </div>
              <button onClick={registrarVentaLocal} disabled={carritoLocal.length === 0 || !formaPagoLocal || cargando}
                style={{ width: "100%", padding: "13px", background: ventaExitosa ? "#16a34a" : carritoLocal.length === 0 || !formaPagoLocal ? "#1a1a1a" : "#1d4ed8", border: "none", borderRadius: 9, color: carritoLocal.length === 0 || !formaPagoLocal ? "#333" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, cursor: "pointer", transition: "background 0.2s" }}>
                {ventaExitosa ? "✓ REGISTRADO" : cargando ? "Guardando..." : "REGISTRAR VENTA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Historial */}
      {tab === "historial" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ fontSize: 11, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{historial.length} ventas cobradas hoy</div>
            {historial.length === 0 && <div style={{ color: "#2a2a2a", textAlign: "center", padding: 40 }}>Sin ventas registradas aún en esta sesión</div>}
            {historial.map((o) => (
              <div key={o.id} className="fade-in" style={{ background: "#111", borderRadius: 10, padding: "14px 16px", marginBottom: 10, borderLeft: `3px solid ${o.origen === "gomeria" ? "#3b82f6" : "#8b5cf6"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{o.id}</span>
                    <span style={{ fontSize: 10, color: "#555", background: "#1a1a1a", padding: "2px 7px", borderRadius: 4, letterSpacing: 1 }}>{o.origen === "gomeria" ? "GOMERÍA" : "CAJA"}</span>
                    {o.cliente && <span style={{ fontSize: 12, color: "#888" }}>{o.cliente}</span>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#16a34a" }}>${totalOrden(o.items).toLocaleString("es-AR")}</div>
                    <div style={{ fontSize: 10, color: "#444" }}>✓ {o.hora_cobro}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#555" }}>{(o.items || []).map((i) => `${i.nombre} ×${i.cantidad}`).join(" · ")}</div>
                {(o.forma_pago || o.marketing) && (
                  <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                    {o.forma_pago && <span style={{ fontSize: 10, color: "#3b82f6", background: "#0f1f40", padding: "2px 8px", borderRadius: 4 }}>{FORMAS_PAGO.find((f) => f.id === o.forma_pago)?.label}</span>}
                    {o.marketing && <span style={{ fontSize: 10, color: "#8b5cf6", background: "#1a1a2e", padding: "2px 8px", borderRadius: 4 }}>{o.marketing}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
