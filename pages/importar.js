import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

const CAMPOS_DESTINO = [
  { id: "codigo", label: "Código", requerido: false },
  { id: "nombre", label: "Nombre", requerido: true },
  { id: "categoria", label: "Categoría", requerido: false },
  { id: "precio", label: "Precio", requerido: true },
  { id: "activo", label: "Activo", requerido: false },
  { id: "ignorar", label: "— Ignorar columna —", requerido: false },
];

export default function Importador() {
  const [paso, setPaso] = useState(1); // 1=subir, 2=mapear, 3=preview, 4=listo
  const [archivo, setArchivo] = useState(null);
  const [columnas, setColumnas] = useState([]);
  const [filas, setFilas] = useState([]);
  const [mapeo, setMapeo] = useState({});
  const [preview, setPreview] = useState([]);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef();

  const procesarArchivo = useCallback((file) => {
    setError("");
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      setError("Solo se aceptan archivos Excel (.xlsx, .xls) o CSV.");
      return;
    }
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!json.length) { setError("El archivo está vacío."); return; }
        const headers = json[0].map((h) => String(h || "").trim());
        const rows = json.slice(1).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
        setColumnas(headers);
        setFilas(rows);
        // Auto-mapeo inteligente
        const autoMapeo = {};
        headers.forEach((h, i) => {
          const hl = h.toLowerCase();
          if (hl.includes("cod") || hl.includes("art") || hl === "id") autoMapeo[i] = "codigo";
          else if (hl.includes("nom") || hl.includes("desc") || hl.includes("prod")) autoMapeo[i] = "nombre";
          else if (hl.includes("cat") || hl.includes("rub") || hl.includes("tipo")) autoMapeo[i] = "categoria";
          else if (hl.includes("prec") || hl.includes("valor") || hl.includes("pvp") || hl.includes("cost")) autoMapeo[i] = "precio";
          else autoMapeo[i] = "ignorar";
        });
        setMapeo(autoMapeo);
        setPaso(2);
      } catch {
        setError("No se pudo leer el archivo. Verificá que no esté dañado.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  };

  const generarPreview = () => {
    const tieneNombre = Object.values(mapeo).includes("nombre");
    const tienePrecio = Object.values(mapeo).includes("precio");
    if (!tieneNombre || !tienePrecio) {
      setError("Tenés que mapear al menos Nombre y Precio.");
      return;
    }
    setError("");
    const colByField = {};
    Object.entries(mapeo).forEach(([idx, field]) => { if (field !== "ignorar") colByField[field] = Number(idx); });
    const items = filas.slice(0, 200).map((row) => ({
      codigo: row[colByField.codigo] != null ? String(row[colByField.codigo]).trim() : "",
      nombre: row[colByField.nombre] != null ? String(row[colByField.nombre]).trim() : "",
      categoria: row[colByField.categoria] != null ? String(row[colByField.categoria]).trim() : "",
      precio: row[colByField.precio] != null ? String(row[colByField.precio]).replace(/[^0-9.,]/g, "").replace(",", ".") : "",
      activo: "true",
    })).filter((i) => i.nombre && i.precio);
    setPreview(items);
    setPaso(3);
  };

  const importar = async () => {
    setImportando(true);
    setError("");
    try {
      const res = await fetch("/api/productos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: preview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al importar");
      setResultado(data);
      setPaso(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setImportando(false);
    }
  };

  const reiniciar = () => {
    setPaso(1); setArchivo(null); setColumnas([]); setFilas([]);
    setMapeo({}); setPreview([]); setResultado(null); setError("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter','Segoe UI',sans-serif", color: "#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        select{background:#111;border:1px solid #222;color:#ccc;border-radius:6px;padding:6px 10px;font-size:13px;width:100%;cursor:pointer;outline:none}
        select:focus{border-color:#3b82f6}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .25s ease-out}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite}
      `}</style>

      {/* Header */}
      <div style={{ background: "#111", borderBottom: "1px solid #1e1e1e", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: 1 }}>FB LUBRICENTRO</div>
            <div style={{ fontSize: 10, color: "#444", letterSpacing: 3 }}>IMPORTADOR DE PRODUCTOS · ANTIGRAVITY</div>
          </div>
        </div>
        <a href="/caja" style={{ fontSize: 12, color: "#555", textDecoration: "none", border: "1px solid #222", padding: "5px 12px", borderRadius: 6 }}>← Volver a Caja</a>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 24px" }}>

        {/* Steps indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
          {["Subir archivo", "Mapear columnas", "Previsualizar", "Listo"].map((s, i) => {
            const n = i + 1;
            const done = paso > n;
            const active = paso === n;
            return (
              <div key={n} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: done ? "#16a34a" : active ? "#2563eb" : "#1a1a1a", border: `2px solid ${done ? "#16a34a" : active ? "#2563eb" : "#2a2a2a"}`, color: done || active ? "#fff" : "#444", flexShrink: 0 }}>
                    {done ? "✓" : n}
                  </div>
                  <span style={{ fontSize: 12, color: active ? "#fff" : done ? "#16a34a" : "#444", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
                </div>
                {i < 3 && <div style={{ flex: 1, height: 1, background: done ? "#16a34a" : "#1e1e1e", margin: "0 10px" }} />}
              </div>
            );
          })}
        </div>

        {error && (
          <div style={{ background: "#2d1515", border: "1px solid #ef444455", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "#f87171" }}>
            ⚠️ {error}
          </div>
        )}

        {/* PASO 1: Subir */}
        {paso === 1 && (
          <div className="fade-up">
            <div style={{ fontSize: 22, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, marginBottom: 6 }}>Subir lista de proveedor</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>Aceptamos Excel (.xlsx, .xls) y CSV. El sistema detecta las columnas automáticamente.</div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current.click()}
              style={{ border: `2px dashed ${dragOver ? "#3b82f6" : "#2a2a2a"}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", cursor: "pointer", background: dragOver ? "#0f1f4020" : "#111", transition: "all .2s" }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: dragOver ? "#3b82f6" : "#ccc", marginBottom: 6 }}>
                {dragOver ? "Soltá el archivo acá" : "Arrastrá el archivo o hacé click"}
              </div>
              <div style={{ fontSize: 12, color: "#444" }}>Excel (.xlsx, .xls) · CSV</div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={(e) => e.target.files[0] && procesarArchivo(e.target.files[0])} />
            </div>
          </div>
        )}

        {/* PASO 2: Mapear */}
        {paso === 2 && (
          <div className="fade-up">
            <div style={{ fontSize: 22, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, marginBottom: 4 }}>Mapear columnas</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
              Archivo: <span style={{ color: "#888" }}>{archivo?.name}</span> · {filas.length} filas detectadas
            </div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 24 }}>El sistema intentó mapear automáticamente. Corregí lo que haga falta.</div>

            <div style={{ background: "#111", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, padding: "10px 16px", borderBottom: "1px solid #1e1e1e", fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                <span>Columna en el archivo</span>
                <span></span>
                <span>Campo en el sistema</span>
              </div>
              {columnas.map((col, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 0, padding: "10px 16px", borderBottom: idx < columnas.length - 1 ? "1px solid #141414" : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ddd" }}>{col || `(columna ${idx + 1})`}</div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
                      {filas[0]?.[idx] != null ? String(filas[0][idx]).slice(0, 30) : "—"}
                    </div>
                  </div>
                  <div style={{ textAlign: "center", color: "#333", fontSize: 16 }}>→</div>
                  <select value={mapeo[idx] || "ignorar"} onChange={(e) => setMapeo({ ...mapeo, [idx]: e.target.value })}>
                    {CAMPOS_DESTINO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={reiniciar} style={{ padding: "10px 20px", background: "transparent", border: "1px solid #222", borderRadius: 8, color: "#555", fontSize: 13, cursor: "pointer" }}>← Volver</button>
              <button onClick={generarPreview} style={{ flex: 1, padding: "12px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, cursor: "pointer", letterSpacing: 1 }}>
                PREVISUALIZAR →
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: Preview */}
        {paso === 3 && (
          <div className="fade-up">
            <div style={{ fontSize: 22, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, marginBottom: 4 }}>Previsualización</div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 24 }}>
              Se van a importar <strong style={{ color: "#fff" }}>{preview.length} productos</strong>. Verificá que los datos sean correctos antes de confirmar.
            </div>

            <div style={{ background: "#111", borderRadius: 12, overflow: "hidden", border: "1px solid #1e1e1e", marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 80px", gap: 0, padding: "10px 16px", borderBottom: "1px solid #1e1e1e", fontSize: 10, color: "#444", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                <span>Código</span><span>Nombre</span><span>Categoría</span><span style={{ textAlign: "right" }}>Precio</span>
              </div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {preview.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 80px", gap: 0, padding: "10px 16px", borderBottom: i < preview.length - 1 ? "1px solid #141414" : "none", alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: "#555", fontFamily: "monospace" }}>{p.codigo || "—"}</div>
                    <div style={{ fontSize: 13, color: "#ddd", fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{p.categoria || "—"}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6", textAlign: "right", fontFamily: "'Barlow Condensed',sans-serif" }}>${Number(p.precio).toLocaleString("es-AR")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPaso(2)} style={{ padding: "10px 20px", background: "transparent", border: "1px solid #222", borderRadius: 8, color: "#555", fontSize: 13, cursor: "pointer" }}>← Corregir</button>
              <button onClick={importar} disabled={importando} style={{ flex: 1, padding: "12px", background: importando ? "#1a1a1a" : "#16a34a", border: "none", borderRadius: 8, color: importando ? "#333" : "#fff", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, cursor: importando ? "not-allowed" : "pointer", letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {importando ? (
                  <><span style={{ width: 16, height: 16, border: "2px solid #444", borderTopColor: "#888", borderRadius: "50%", display: "inline-block" }} className="spin"></span> Importando...</>
                ) : `✓ IMPORTAR ${preview.length} PRODUCTOS`}
              </button>
            </div>
          </div>
        )}

        {/* PASO 4: Listo */}
        {paso === 4 && (
          <div className="fade-up" style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 800, marginBottom: 8 }}>
              ¡Importación exitosa!
            </div>
            <div style={{ fontSize: 15, color: "#555", marginBottom: 32 }}>
              Se importaron <strong style={{ color: "#fff" }}>{resultado?.importados || preview.length} productos</strong> al catálogo.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={reiniciar} style={{ padding: "12px 24px", background: "#111", border: "1px solid #222", borderRadius: 8, color: "#ccc", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Importar otra lista
              </button>
              <a href="/caja" style={{ padding: "12px 24px", background: "#2563eb", border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                Ir a Caja →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
