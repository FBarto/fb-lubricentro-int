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
  const [cargandoServicios, setCargandoServicios] = useState(true);
  const [carrito, setCarrito] = useState([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [grupoActivo, setGrupoActivo] = useState("Autos");
  const [showModal, setShowModal] = useState(false);
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [telefono, setTelefono] = useState("");

  // Cargar servicios desde Sheets al iniciar
  useEffect(() => {
    fetch('/api/gomeria/servicios')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setServicios(data);
      })
      .catch(() => setError("No se pudieron cargar los servicios."))
      .finally(() => setCargandoServicios(false));
  }, []);

  const agregarServicio = (servicio) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === servicio.id);
      if (existe) return prev.map((i) => i.id === servicio.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...servicio, cantidad: 1 }];
    });
  };

  const quitarServicio = (id) => {
    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === id);
      if (existe.cantidad === 1) return prev.filter((i) => i.id !== id);
      return prev.map((i) => i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const total = carrito.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

  const abrirModal = () => {
    if (carrito.length === 0) return;
    setShowModal(true);
    setError("");
  };

  const enviarACaja = async () => {
    setShowModal(false);
    setEnviando(true);
    setError("");
    try {
      const res = await fetch('/api/gomeria/orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: carrito, cliente_nombre: clienteNombre, patente, marca, modelo, telefono }),
      });
      if (!res.ok) throw new Error('Error al enviar');
      setEnviado(true);
      setTimeout(() => {
        setEnviado(false);
        setCarrito([]);
        setClienteNombre(""); setPatente(""); setMarca(""); setModelo(""); setTelefono("");
      }, 2500);
    } catch {
      setError("No se pudo enviar. Verificá la conexión.");
    } finally {
      setEnviando(false);
    }
  };

  const serviciosDelGrupo = servicios.filter((s) => s.grupo === grupoActivo);
  const colores = GRUPO_COLORS[grupoActivo];

  if (cargandoServicios) return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: "3px solid #222", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, color: "#555", letterSpacing: 2 }}>CARGANDO SERVICIOS...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: "'Barlow Condensed', Arial, sans-serif", display: "flex", flexDirection: "column", userSelect: "none" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .btn-servicio:active { transform: scale(0.95); }
        @keyframes popIn { 0% { transform: scale(0.5); } 70% { transform: scale(1.2); } 100% { transform: scale(1); } }
        .qty-badge { animation: popIn 0.15s ease-out; }
        @keyframes checkmark { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        .check-anim { animation: checkmark 0.4s ease-out forwards; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "2px solid #222", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>FB LUBRICENTRO</div>
          <div style={{ fontSize: 11, color: "#666", letterSpacing: 3, textTransform: "uppercase" }}>Gomería · AntiGravity</div>
        </div>
        <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "6px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 2 }}>TURNO</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel servicios */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", background: "#111", borderBottom: "1px solid #222", padding: "8px 10px 0", gap: 6 }}>
            {GRUPOS.map((g) => {
              const c = GRUPO_COLORS[g];
              const activo = g === grupoActivo;
              const cant = carrito.filter((i) => i.grupo === g).reduce((s, i) => s + i.cantidad, 0);
              return (
                <button key={g} onClick={() => setGrupoActivo(g)}
                  style={{ flex: 1, padding: "10px 6px", border: "none", borderRadius: "8px 8px 0 0", background: activo ? c.bg : "#1a1a1a", color: activo ? c.light : "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: activo ? 700 : 600, cursor: "pointer", position: "relative", borderBottom: activo ? `3px solid ${c.accent}` : "3px solid transparent" }}>
                  {g}
                  {cant > 0 && <span style={{ position: "absolute", top: 4, right: 4, background: c.accent, color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{cant}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1, padding: 12, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, alignContent: "start", background: colores.bg + "55", overflowY: "auto" }}>
            {serviciosDelGrupo.map((s) => {
              const enCarrito = carrito.find((i) => i.id === s.id);
              return (
                <button key={s.id} className="btn-servicio" onClick={() => agregarServicio(s)}
                  style={{ background: enCarrito ? colores.bg : "#1a1a1a", border: `2px solid ${enCarrito ? colores.accent : "#2a2a2a"}`, borderRadius: 14, padding: "18px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", boxShadow: enCarrito ? `0 0 20px ${colores.accent}33` : "none", transition: "all 0.15s" }}>
                  {enCarrito && <span className="qty-badge" key={enCarrito.cantidad} style={{ position: "absolute", top: 8, right: 8, background: colores.accent, color: "#fff", borderRadius: "50%", width: 24, height: 24, fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{enCarrito.cantidad}</span>}
                  <span style={{ fontSize: 32 }}>{s.icon}</span>
                  <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, color: enCarrito ? colores.light : "#ccc", textAlign: "center", lineHeight: 1.2 }}>{s.label}</span>
                  <span style={{ fontSize: 13, color: enCarrito ? colores.accent : "#444", fontWeight: 600 }}>${s.precio.toLocaleString("es-AR")}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Carrito */}
        <div style={{ width: 240, background: "#111", borderLeft: "1px solid #222", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #222", fontSize: 13, fontWeight: 700, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>Orden Actual</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
            {carrito.length === 0
              ? <div style={{ textAlign: "center", color: "#333", fontSize: 13, padding: "30px 10px" }}>Seleccioná servicios</div>
              : carrito.map((item) => {
                  const c = GRUPO_COLORS[item.grupo];
                  return (
                    <div key={item.id} style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px", marginBottom: 8, borderLeft: `3px solid ${c.accent}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, color: "#e0e0e0" }}>{item.icon} {item.label}</div>
                        <div style={{ fontSize: 11, color: "#555" }}>${item.precio.toLocaleString()} × {item.cantidad}</div>
                        <div style={{ fontSize: 13, color: c.accent, fontWeight: 700 }}>${(item.precio * item.cantidad).toLocaleString("es-AR")}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button onClick={() => agregarServicio(item)} style={{ width: 26, height: 26, background: "#2a2a2a", border: `1px solid ${c.accent}55`, borderRadius: 6, color: c.accent, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>+</button>
                        <button onClick={() => quitarServicio(item.id)} style={{ width: 26, height: 26, background: "#2a2a2a", border: "1px solid #333", borderRadius: 6, color: "#666", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>−</button>
                      </div>
                    </div>
                  );
                })}
          </div>
          <div style={{ padding: "12px 14px", borderTop: "1px solid #222" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: 1, textTransform: "uppercase" }}>Total</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 800, color: "#fff" }}>${total.toLocaleString("es-AR")}</span>
            </div>
            {error && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8, textAlign: "center" }}>{error}</div>}
            <button onClick={abrirModal} disabled={carrito.length === 0 || enviando}
              style={{ width: "100%", padding: "14px", background: enviado ? "#16a34a" : carrito.length === 0 ? "#1a1a1a" : "#2563eb", border: "none", borderRadius: 10, color: carrito.length === 0 ? "#333" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: 1, cursor: carrito.length === 0 ? "not-allowed" : "pointer", transition: "background 0.3s" }}>
              {enviado ? <span className="check-anim">✓ ENVIADO A CAJA</span> : enviando ? "Enviando..." : "📤 ENVIAR A CAJA"}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL datos del vehículo */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>Datos del vehículo</div>
              <button onClick={() => setShowModal(false)} style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, width: 32, height: 32, color: "#666", cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Resumen de la orden */}
            <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 14px", marginBottom: 20, borderLeft: "3px solid #2563eb" }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{carrito.map(i => `${i.icon} ${i.label}${i.cantidad > 1 ? ` ×${i.cantidad}` : ""}`).join("  ·  ")}</div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff" }}>${total.toLocaleString("es-AR")}</div>
            </div>

            {/* Patente */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Patente</div>
              <input
                type="text"
                placeholder="ABC 123"
                value={patente}
                onChange={(e) => setPatente(e.target.value.toUpperCase())}
                autoFocus
                style={{ width: "100%", background: "#0d1b33", border: "2px solid #3b82f655", borderRadius: 10, padding: "12px 14px", color: "#93c5fd", fontSize: 22, fontWeight: 800, letterSpacing: 4, textAlign: "center", outline: "none", fontFamily: "'Barlow Condensed',sans-serif" }}
              />
            </div>

            {/* Marca y Modelo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Marca</div>
                <input type="text" placeholder="Ford" value={marca} onChange={(e) => setMarca(e.target.value)}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ccc", fontSize: 14, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Modelo</div>
                <input type="text" placeholder="Focus" value={modelo} onChange={(e) => setModelo(e.target.value)}
                  style={{ width: "100%", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ccc", fontSize: 14, outline: "none" }} />
              </div>
            </div>

            {/* Separador opcional */}
            <div style={{ borderTop: "1px solid #1e1e1e", marginBottom: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Cliente (opcional)</div>
              <input type="text" placeholder="Nombre del cliente" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)}
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 12px", color: "#ccc", fontSize: 14, outline: "none", marginBottom: 8 }} />
              <input type="tel" placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)}
                style={{ width: "100%", background: "#1a1a1a", border: "1px solid #1e1e1e", borderRadius: 8, padding: "10px 12px", color: "#ccc", fontSize: 14, outline: "none" }} />
            </div>

            {/* Botones */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowModal(false)}
                style={{ flex: 1, padding: "13px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, color: "#555", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={enviarACaja}
                style={{ flex: 2, padding: "13px", background: "#2563eb", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: 1, cursor: "pointer" }}>
                📤 ENVIAR A CAJA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
