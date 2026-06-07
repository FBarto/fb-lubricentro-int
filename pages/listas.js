import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import AuthGuard, { useAuth } from '../components/AuthGuard';

export default function ListasPage() {
  return (
    <AuthGuard pantalla="Listas">
      <ListasContent />
    </AuthGuard>
  );
}

// ─── Categorías disponibles ───────────────────────────────────────────────────
const CATEGORIAS = ['aceites', 'filtros', 'bujias', 'frenos', 'refrigerante', 'aditivos', 'accesorios', 'escobillas'];

const CAMPOS_MAPEO = [
  { id: 'codigo',       label: 'Código proveedor' },
  { id: 'nombre',       label: 'Nombre' },
  { id: 'marca',        label: 'Marca' },
  { id: 'precio_costo', label: 'Precio costo' },
  { id: 'precio_lista', label: 'Precio lista' },
  { id: 'stock',        label: 'Stock' },
  { id: 'ignorar',      label: '— Ignorar —' },
];

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const S = {
  card: { background: '#111', border: '1px solid #1e1e1e', borderRadius: 14, padding: 24 },
  btn: { background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  btnGhost: { background: 'transparent', border: '1px solid #2a2a2a', color: '#666', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' },
  btnDanger: { background: 'transparent', border: '1px solid #7f1d1d', color: '#f87171', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' },
  input: { background: '#0d0d0d', border: '1px solid #222', color: '#ccc', borderRadius: 8, padding: '9px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: '#555', letterSpacing: 1, textTransform: 'uppercase', display: 'block', marginBottom: 6 },
};

// ─── Componente principal ─────────────────────────────────────────────────────
function ListasContent() {
  const { sesion, onCambiarUsuario } = useAuth();

  // ── Estado general ────────────────────────────────────────────────────────
  const [proveedores, setProveedores]     = useState([]);
  const [archivosDrive, setArchivosDrive] = useState([]);
  const [cargandoDrive, setCargandoDrive] = useState(false);
  const [errorDrive, setErrorDrive]       = useState('');
  const [sinDrive, setSinDrive]           = useState(false);

  // ── Modal de importación ──────────────────────────────────────────────────
  const [modalArchivo, setModalArchivo]   = useState(null); // archivo a procesar
  const [modalPaso, setModalPaso]         = useState(1);    // 1=config, 2=mapeo, 3=preview, 4=listo
  const [provSel, setProvSel]             = useState('');
  const [margen, setMargen]               = useState(40);
  const [modo, setModo]                   = useState('solo_precios');
  const [columnas, setColumnas]           = useState([]);
  const [filas, setFilas]                 = useState([]);
  const [mapeo, setMapeo]                 = useState({});
  const [preview, setPreview]             = useState([]);
  const [advertencia, setAdvertencia]     = useState('');
  const [procesando, setProcesando]       = useState(false);
  const [importando, setImportando]       = useState(false);
  const [resultado, setResultado]         = useState(null);
  const [guardarMapeo, setGuardarMapeo]   = useState(false);
  const [errorModal, setErrorModal]       = useState('');
  const [totalFilas, setTotalFilas]       = useState(0);

  // ── Modal de nuevo proveedor ──────────────────────────────────────────────
  const [showNuevoProv, setShowNuevoProv] = useState(false);
  const [nuevoProv, setNuevoProv]         = useState({ id: '', nombre: '', margen_default: '40', categoria_default: 'aceites' });
  const [creandoProv, setCreandoProv]     = useState(false);
  const [errorNuevoProv, setErrorNuevoProv] = useState('');

  // ── Upload manual ─────────────────────────────────────────────────────────
  const [dragOver, setDragOver]           = useState(false);
  const inputRef                          = useRef();

  // ─── Cargar datos iniciales ─────────────────────────────────────────────────
  useEffect(() => {
    cargarProveedores();
    cargarDrive();
  }, []);

  const cargarProveedores = async () => {
    try {
      const res = await fetch('/api/listas/proveedores');
      if (!res.ok) return;
      const data = await res.json();
      setProveedores(data.filter((p) => !p.nombre?.startsWith('[ELIMINADO]')));
    } catch {}
  };

  const cargarDrive = async () => {
    setCargandoDrive(true);
    setErrorDrive('');
    try {
      const res = await fetch('/api/listas/drive/pendientes');
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes('DRIVE_FOLDER_LISTAS_ID')) {
          setSinDrive(true);
        } else {
          setErrorDrive(data.error || 'Error al consultar Drive');
        }
        return;
      }
      setArchivosDrive(data.archivos || []);
    } catch {
      setErrorDrive('No se pudo conectar con Drive');
    } finally {
      setCargandoDrive(false);
    }
  };

  // ─── Abrir modal: archivo desde Drive ──────────────────────────────────────
  const abrirDesdeDrive = (archivo) => {
    setModalArchivo({ ...archivo, fuente: 'drive' });
    setModalPaso(1);
    setProvSel('');
    setMargen(40);
    setModo('solo_precios');
    setColumnas([]);
    setFilas([]);
    setMapeo({});
    setPreview([]);
    setResultado(null);
    setAdvertencia('');
    setErrorModal('');
    setGuardarMapeo(false);
    setTotalFilas(0);
  };

  // ─── Abrir modal: archivo subido manualmente ────────────────────────────────
  const procesarArchivoLocal = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext)) {
      alert('Solo se aceptan archivos Excel (.xlsx, .xls), CSV o PDF.');
      return;
    }

    setModalArchivo({ nombre: file.name, tipo: ext === 'pdf' ? 'pdf' : ['xlsx','xls'].includes(ext) ? 'excel' : 'csv', fuente: 'local', _file: file });
    setModalPaso(1);
    setProvSel('');
    setMargen(40);
    setModo('solo_precios');
    setColumnas([]);
    setFilas([]);
    setMapeo({});
    setPreview([]);
    setResultado(null);
    setAdvertencia('');
    setErrorModal('');
    setGuardarMapeo(false);
    setTotalFilas(0);
  }, []);

  // ─── Paso 1 → 2: descargar/leer el archivo y parsear ───────────────────────
  const procesarArchivo = async () => {
    setProcesando(true);
    setErrorModal('');
    try {
      if (modalArchivo.fuente === 'drive') {
        // Descargar desde Drive y parsear en el servidor
        const res = await fetch('/api/listas/drive/procesar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: modalArchivo.id,
            fileName: modalArchivo.nombre,
            fileType: modalArchivo.tipo,
            proveedor_id: provSel || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error procesando archivo');

        setColumnas(data.columnas || []);
        setFilas(data.filas || []);
        setMapeo(data.mapeo || {});
        setTotalFilas(data.total_filas || 0);
        setAdvertencia(data.advertencia || '');

        // Si tiene perfil guardado → ir directo a previsualización
        if (data.perfil?.mapeo_columnas && provSel) {
          const m = typeof data.mapeo === 'object' ? data.mapeo : {};
          const prev = generarPreview(data.filas || [], data.columnas || [], m, margen);
          if (prev.length > 0) {
            setPreview(prev);
            setModalPaso(3);
            return;
          }
        }

      } else {
        // Leer archivo local
        const file = modalArchivo._file;
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'pdf') {
          // PDF: leer como base64 y enviar al servidor
          const base64 = await fileToBase64(file);
          const res = await fetch('/api/listas/parsear-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64 }),
          });
          const data = await res.json();
          setColumnas(data.columnas || []);
          setFilas(data.filas || []);
          setTotalFilas(data.total_filas || 0);
          setAdvertencia(data.advertencia || '');
          // Auto-mapeo básico para PDF
          const m = {};
          (data.columnas || []).forEach((_, i) => { m[i] = 'ignorar'; });
          setMapeo(m);
        } else {
          // Excel/CSV: leer en el cliente con xlsx
          const buf = await file.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
          const { headers, rows } = detectarCabecera(json);
          setColumnas(headers);
          setFilas(rows);
          setTotalFilas(rows.length);
          setMapeo(autoMapear(headers));
        }
      }

      setModalPaso(2);
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setProcesando(false);
    }
  };

  // ─── Paso 2 → 3: generar previsualización ──────────────────────────────────
  const irAPreview = () => {
    if (!Object.values(mapeo).includes('precio_costo')) {
      setErrorModal('Tenés que mapear al menos la columna de Precio Costo.');
      return;
    }
    if (!Object.values(mapeo).includes('nombre')) {
      setErrorModal('Tenés que mapear al menos la columna de Nombre.');
      return;
    }
    setErrorModal('');
    const prev = generarPreview(filas, columnas, mapeo, margen);
    setPreview(prev);
    setModalPaso(3);
  };

  // ─── Paso 3 → 4: importar ──────────────────────────────────────────────────
  const importar = async () => {
    setImportando(true);
    setErrorModal('');
    try {
      const res = await fetch('/api/listas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productos: preview,
          proveedor_id: provSel || undefined,
          margen,
          modo,
          file_id: modalArchivo.fuente === 'drive' ? modalArchivo.id : undefined,
          guardar_mapeo: guardarMapeo,
          mapeo_columnas: guardarMapeo ? mapeo : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al importar');
      setResultado(data);
      setModalPaso(4);
      // Refrescar drive y proveedores
      cargarDrive();
      cargarProveedores();
    } catch (err) {
      setErrorModal(err.message);
    } finally {
      setImportando(false);
    }
  };

  // ─── Crear nuevo proveedor ──────────────────────────────────────────────────
  const crearProveedor = async () => {
    if (!nuevoProv.id || !nuevoProv.nombre) {
      setErrorNuevoProv('ID y nombre son obligatorios');
      return;
    }
    setCreandoProv(true);
    setErrorNuevoProv('');
    try {
      const res = await fetch('/api/listas/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoProv),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear proveedor');
      setShowNuevoProv(false);
      setNuevoProv({ id: '', nombre: '', margen_default: '40', categoria_default: 'aceites' });
      cargarProveedores();
    } catch (err) {
      setErrorNuevoProv(err.message);
    } finally {
      setCreandoProv(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
  const fmtTamaño = (bytes) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return `hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === ayer.toDateString()) return `ayer ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('es-AR');
  };

  const iconoTipo = (tipo) => ({ excel: '📊', csv: '📄', pdf: '📋' }[tipo] || '📁');
  const colorEstado = { actualizado: '#22c55e', creado: '#3b82f6', sin_cambio: '#444', omitido: '#888', error: '#ef4444' };
  const labelEstado = { actualizado: 'Actualizado', creado: 'Creado', sin_cambio: 'Sin cambio', omitido: 'Omitido', error: 'Error' };

  // Cuando cambia el margen en el paso 3, recalcular preview
  const actualizarMargen = (nuevoMargen) => {
    setMargen(nuevoMargen);
    if (modalPaso === 3 && filas.length > 0) {
      setPreview(generarPreview(filas, columnas, mapeo, nuevoMargen));
    }
  };

  const proveedorSelObj = proveedores.find((p) => p.id === provSel);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: "'Inter','Segoe UI',sans-serif", color: '#fff' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select{background:#0d0d0d;border:1px solid #222;color:#ccc;border-radius:8px;padding:9px 14px;font-size:13px;outline:none;font-family:inherit}
        input:focus,select:focus{border-color:#3b82f6}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:4px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp .2s ease-out}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin 1s linear infinite}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .pulse{animation:pulse 1.5s ease-in-out infinite}
        .row-hover:hover{background:#161616!important}
        .btn-prim{background:#3b82f6;border:none;color:#fff;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:600;cursor:pointer;transition:background .15s}
        .btn-prim:hover{background:#2563eb}
        .btn-prim:disabled{background:#1a1a1a;color:#333;cursor:not-allowed}
        .btn-ghost{background:transparent;border:1px solid #2a2a2a;color:#666;border-radius:8px;padding:8px 16px;font-size:12px;cursor:pointer;transition:all .15s}
        .btn-ghost:hover{border-color:#444;color:#aaa}
        .archivo-card:hover{border-color:#3b82f620!important;background:#0f0f0f!important}
        .prov-card:hover{border-color:#3b82f640!important}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:linear-gradient(to right,#3b82f6 var(--val),#222 var(--val));outline:none;cursor:pointer;border:none;padding:0}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#3b82f6;cursor:pointer;border:2px solid #0a0a0a}
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📋</div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 21, fontWeight: 800, letterSpacing: 1 }}>LISTAS DE PRECIOS</div>
            <div style={{ fontSize: 10, color: '#444', letterSpacing: 3 }}>LUBRICENTRO · ANTIGRAVITY</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/importar" style={{ fontSize: 12, color: '#555', textDecoration: 'none', border: '1px solid #222', padding: '5px 12px', borderRadius: 6 }}>Importador Excel</a>
          <a href="/admin" style={{ fontSize: 12, color: '#555', textDecoration: 'none', border: '1px solid #222', padding: '5px 12px', borderRadius: 6 }}>← Admin</a>
          <div style={{ width: 1, height: 24, background: '#1e1e1e' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: '#444', letterSpacing: 2 }}>USUARIO</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#ccc' }}>👤 {sesion?.nombre}</div>
          </div>
          <button onClick={onCambiarUsuario} className="btn-ghost" style={{ fontSize: 11, letterSpacing: 1, padding: '5px 12px' }}>CAMBIAR</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Upload manual (dropzone siempre visible) ───────────────────── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) procesarArchivoLocal(f); }}
          onClick={() => inputRef.current.click()}
          style={{ border: `2px dashed ${dragOver ? '#3b82f6' : '#1e1e1e'}`, borderRadius: 14, padding: '28px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#0f1f4020' : '#0d0d0d', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}
        >
          <div style={{ fontSize: 28 }}>{dragOver ? '📥' : '📂'}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: dragOver ? '#3b82f6' : '#aaa' }}>{dragOver ? 'Soltá el archivo acá' : 'Subir lista manualmente'}</div>
            <div style={{ fontSize: 12, color: '#444', marginTop: 3 }}>Excel (.xlsx, .xls) · CSV · PDF — arrastrá o hacé click</div>
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && procesarArchivoLocal(e.target.files[0])} />
        </div>

        {/* ── Bandeja Drive ─────────────────────────────────────────────────── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a3a6e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📥</div>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800 }}>BANDEJA DRIVE</div>
                <div style={{ fontSize: 11, color: '#555' }}>Archivos pendientes de procesar en la carpeta compartida</div>
              </div>
            </div>
            <button onClick={cargarDrive} className="btn-ghost" disabled={cargandoDrive} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {cargandoDrive
                ? <span style={{ width: 12, height: 12, border: '2px solid #333', borderTopColor: '#888', borderRadius: '50%', display: 'inline-block' }} className="spin" />
                : '🔄'}
              {cargandoDrive ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>

          {sinDrive && (
            <div style={{ background: '#1a1200', border: '1px solid #78350f40', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 6 }}>⚙️ Drive no configurado</div>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                Para usar la bandeja Drive, configurá la variable de entorno <code style={{ background: '#0d0d0d', padding: '1px 6px', borderRadius: 4 }}>DRIVE_FOLDER_LISTAS_ID</code> con el ID de la carpeta de Google Drive compartida con el Service Account.
                <br />Mientras tanto, podés subir los archivos manualmente desde el área de arriba.
              </div>
            </div>
          )}

          {errorDrive && !sinDrive && (
            <div style={{ background: '#2d1515', border: '1px solid #ef444430', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#f87171' }}>
              ❌ {errorDrive}
            </div>
          )}

          {!sinDrive && !errorDrive && (
            cargandoDrive
              ? <div style={{ textAlign: 'center', padding: '32px 0', color: '#333', fontSize: 13 }} className="pulse">Consultando Drive...</div>
              : archivosDrive.length === 0
                ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <div style={{ color: '#555', fontSize: 13 }}>No hay archivos pendientes en Drive</div>
                    <div style={{ color: '#333', fontSize: 12, marginTop: 4 }}>Guardá listas de precios en la carpeta compartida para verlas acá</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {archivosDrive.map((arch) => (
                      <div key={arch.id} className="archivo-card" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'default', transition: 'all .15s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: 24 }}>{iconoTipo(arch.tipo)}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb' }}>{arch.nombre}</div>
                            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                              {arch.tipo.toUpperCase()} · {fmtTamaño(arch.tamaño)} · {fmtFecha(arch.fecha)}
                            </div>
                          </div>
                        </div>
                        <button className="btn-prim" onClick={() => abrirDesdeDrive(arch)} style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '8px 18px' }}>
                          Procesar →
                        </button>
                      </div>
                    ))}
                  </div>
                )
          )}
        </div>

        {/* ── Perfiles de Proveedor ──────────────────────────────────────────── */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800 }}>PROVEEDORES</div>
              <div style={{ fontSize: 11, color: '#555' }}>Perfiles guardados con margen y formato de columnas</div>
            </div>
            <button className="btn-prim" onClick={() => setShowNuevoProv(true)} style={{ fontSize: 12, padding: '8px 16px' }}>+ Nuevo proveedor</button>
          </div>

          {proveedores.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#333', fontSize: 13 }}>
                Sin proveedores configurados. Creá el primero para acelerar futuras importaciones.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                {proveedores.map((p) => (
                  <div key={p.id} className="prov-card" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: 12, padding: '18px', transition: 'border-color .15s' }}>
                    <div style={{ fontSize: 18, marginBottom: 8 }}>🏭</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>{p.nombre}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, color: '#555' }}>Margen: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{p.margen_default}%</span></div>
                      <div style={{ fontSize: 11, color: '#555' }}>Categoría: <span style={{ color: '#888' }}>{p.categoria_default || '—'}</span></div>
                      {p.ultima_importacion && <div style={{ fontSize: 11, color: '#555' }}>Última: <span style={{ color: '#888' }}>{p.ultima_importacion}</span></div>}
                      {p.productos_actualizados && Number(p.productos_actualizados) > 0 && (
                        <div style={{ fontSize: 11, color: '#555' }}>{p.productos_actualizados} productos</div>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#2a2a2a', fontFamily: 'monospace' }}>{p.id}</div>
                  </div>
                ))}
              </div>
            )
          }
        </div>

      </div>

      {/* ═══ MODAL: Importar archivo ════════════════════════════════════════════ */}
      {modalArchivo && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000dd', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget && !importando) { setModalArchivo(null); } }}>
          <div className="fade-up" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 18, width: '100%', maxWidth: 660, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Header del modal */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#111', zIndex: 1 }}>
              <div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800 }}>
                  {iconoTipo(modalArchivo.tipo)} {modalArchivo.nombre}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  {['Configurar', 'Mapear columnas', 'Previsualizar', 'Listo'][modalPaso - 1]}
                </div>
              </div>
              {/* Steps */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {[1,2,3,4].map((n) => (
                  <div key={n} style={{ width: 24, height: 24, borderRadius: '50%', background: modalPaso > n ? '#16a34a' : modalPaso === n ? '#2563eb' : '#1a1a1a', border: `2px solid ${modalPaso > n ? '#16a34a' : modalPaso === n ? '#2563eb' : '#2a2a2a'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: modalPaso >= n ? '#fff' : '#444' }}>
                    {modalPaso > n ? '✓' : n}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ padding: '24px' }}>

              {errorModal && (
                <div style={{ background: '#2d1515', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: '#f87171' }}>
                  ⚠️ {errorModal}
                </div>
              )}

              {advertencia && modalPaso >= 2 && (
                <div style={{ background: '#1a1200', border: '1px solid #78350f40', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#fbbf24' }}>
                  ⚠️ {advertencia}
                </div>
              )}

              {/* ── PASO 1: Configurar ───────────────────────────────────────── */}
              {modalPaso === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={S.label}>Proveedor (opcional)</label>
                    <select value={provSel} onChange={(e) => {
                      setProvSel(e.target.value);
                      const p = proveedores.find((x) => x.id === e.target.value);
                      if (p) setMargen(Number(p.margen_default) || 40);
                    }} style={{ width: '100%' }}>
                      <option value="">— Sin perfil de proveedor —</option>
                      {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    {provSel && <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>✓ El mapeo de columnas guardado se aplicará automáticamente</div>}
                  </div>

                  <div>
                    <label style={S.label}>Margen de ganancia: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{margen}%</span></label>
                    <input
                      type="range" min={0} max={150} value={margen}
                      style={{ '--val': `${margen / 150 * 100}%` }}
                      onChange={(e) => setMargen(Number(e.target.value))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', marginTop: 4 }}>
                      <span>0%</span><span>75%</span><span>150%</span>
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Modo de importación</label>
                    {[
                      { id: 'solo_precios', label: 'Solo actualizar precios', desc: 'No crea productos nuevos — solo actualiza los que ya existen en el catálogo' },
                      { id: 'crear_tambien', label: 'Actualizar + crear nuevos', desc: 'Actualiza precios existentes Y agrega al catálogo los que no estén' },
                    ].map((m) => (
                      <div key={m.id} onClick={() => setModo(m.id)}
                        style={{ background: modo === m.id ? '#0f1f40' : '#0d0d0d', border: `1px solid ${modo === m.id ? '#1e3a8a' : '#1e1e1e'}`, borderRadius: 9, padding: '12px 16px', marginTop: 8, cursor: 'pointer', transition: 'all .15s' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: modo === m.id ? '#93c5fd' : '#ccc' }}>
                          {modo === m.id ? '● ' : '○ '}{m.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{m.desc}</div>
                      </div>
                    ))}
                  </div>

                  <button className="btn-prim" onClick={procesarArchivo} disabled={procesando} style={{ width: '100%', padding: '13px', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {procesando
                      ? <><span style={{ width: 16, height: 16, border: '2px solid #444', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} className="spin" />Leyendo archivo...</>
                      : 'LEER ARCHIVO →'}
                  </button>
                </div>
              )}

              {/* ── PASO 2: Mapear columnas ──────────────────────────────────── */}
              {modalPaso === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 13, color: '#555' }}>
                    {columnas.length} columnas detectadas · {totalFilas} filas
                    {totalFilas > 500 && <span style={{ color: '#f59e0b' }}> (mostrando primeras 500)</span>}
                  </div>

                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 30px 160px', padding: '8px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 10, color: '#444', letterSpacing: 2, fontWeight: 700 }}>
                      <span>COLUMNA EN ARCHIVO</span><span></span><span>CAMPO EN SISTEMA</span>
                    </div>
                    {columnas.map((col, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 30px 160px', padding: '9px 14px', borderBottom: idx < columnas.length - 1 ? '1px solid #111' : 'none', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{col || `Columna ${idx + 1}`}</div>
                          <div style={{ fontSize: 11, color: '#444' }}>{filas[0]?.[idx] != null ? String(filas[0][idx]).slice(0, 25) : '—'}</div>
                        </div>
                        <div style={{ color: '#333', textAlign: 'center' }}>→</div>
                        <select value={mapeo[idx] || 'ignorar'} onChange={(e) => setMapeo({ ...mapeo, [idx]: e.target.value })}
                          style={{ fontSize: 12, padding: '6px 10px' }}>
                          {CAMPOS_MAPEO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  {/* Guardar mapeo */}
                  {provSel && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#888', cursor: 'pointer' }}>
                      <input type="checkbox" checked={guardarMapeo} onChange={(e) => setGuardarMapeo(e.target.checked)} style={{ width: 'auto' }} />
                      Guardar este mapeo en el perfil de {proveedorSelObj?.nombre}
                    </label>
                  )}

                  {/* Ajuste de margen en el paso 2 */}
                  <div style={{ background: '#0d0d0d', borderRadius: 10, padding: '14px 16px' }}>
                    <label style={S.label}>Margen: <span style={{ color: '#3b82f6', fontWeight: 700 }}>{margen}%</span></label>
                    <input type="range" min={0} max={150} value={margen} style={{ '--val': `${margen / 150 * 100}%` }} onChange={(e) => setMargen(Number(e.target.value))} />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" onClick={() => setModalPaso(1)}>← Volver</button>
                    <button className="btn-prim" onClick={irAPreview} style={{ flex: 1, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>
                      PREVISUALIZAR →
                    </button>
                  </div>
                </div>
              )}

              {/* ── PASO 3: Previsualizar ────────────────────────────────────── */}
              {modalPaso === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Ajuste rápido de margen */}
                  <div style={{ background: '#0d0d0d', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>Margen:</div>
                    <input type="range" min={0} max={150} value={margen} style={{ flex: 1, '--val': `${margen / 150 * 100}%` }} onChange={(e) => actualizarMargen(Number(e.target.value))} />
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color: '#3b82f6', width: 52, textAlign: 'right' }}>{margen}%</div>
                    <input type="number" min={0} max={200} value={margen} onChange={(e) => actualizarMargen(Number(e.target.value))}
                      style={{ width: 64, fontSize: 13, padding: '6px 10px' }} />
                  </div>

                  <div style={{ fontSize: 13, color: '#555' }}>
                    <span style={{ color: '#fff', fontWeight: 700 }}>{preview.length} productos</span>
                    {preview.length !== totalFilas && ` de ${totalFilas} filas`}
                    {modo === 'solo_precios' && <span style={{ color: '#888' }}> · Solo actualiza los que ya están en el catálogo</span>}
                  </div>

                  <div style={{ background: '#0d0d0d', borderRadius: 10, overflow: 'hidden', border: '1px solid #1a1a1a' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px', padding: '8px 14px', borderBottom: '1px solid #1a1a1a', fontSize: 10, color: '#444', letterSpacing: 2, fontWeight: 700 }}>
                      <span>CÓDIGO</span><span>NOMBRE</span><span style={{ textAlign: 'right' }}>COSTO</span><span style={{ textAlign: 'right' }}>VENTA ({margen}%)</span>
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                      {preview.map((p, i) => (
                        <div key={i} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px', padding: '9px 14px', borderBottom: i < preview.length - 1 ? '1px solid #111' : 'none', alignItems: 'center', background: 'transparent', transition: 'background .1s' }}>
                          <div style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>{p.codigo || '—'}</div>
                          <div style={{ fontSize: 13, color: '#ddd', fontWeight: 500 }}>{p.nombre}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', textAlign: 'right', fontFamily: "'Barlow Condensed',sans-serif" }}>{fmt(p.precio_costo)}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#3b82f6', textAlign: 'right', fontFamily: "'Barlow Condensed',sans-serif" }}>{fmt(p.precio_venta_calc)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" onClick={() => setModalPaso(2)}>← Corregir</button>
                    <button className="btn-prim" onClick={importar} disabled={importando}
                      style={{ flex: 1, background: importando ? '#1a1a1a' : '#16a34a', fontFamily: "'Barlow Condensed',sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: importando ? 'not-allowed' : 'pointer' }}>
                      {importando
                        ? <><span style={{ width: 16, height: 16, border: '2px solid #444', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} className="spin" />Importando...</>
                        : `✓ IMPORTAR ${preview.length} PRODUCTOS`}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PASO 4: Resultado ────────────────────────────────────────── */}
              {modalPaso === 4 && resultado && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} className="fade-up">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
                    <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 6 }}>¡Importación completa!</div>
                  </div>

                  {/* Resumen */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                    {[
                      { label: 'Actualizados', value: resultado.actualizados, color: '#22c55e' },
                      { label: 'Creados', value: resultado.creados, color: '#3b82f6' },
                      { label: 'Sin cambio', value: resultado.sin_cambio, color: '#444' },
                      { label: 'Omitidos', value: resultado.omitidos, color: '#888' },
                    ].map((s) => (
                      <div key={s.label} style={{ background: '#0d0d0d', borderRadius: 10, padding: '14px 10px', textAlign: 'center', border: `1px solid ${s.color}20` }}>
                        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: '#555' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detalle */}
                  {resultado.detalles?.filter((d) => d.estado !== 'sin_cambio').length > 0 && (
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {resultado.detalles.filter((d) => d.estado !== 'sin_cambio').map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 7, background: '#0d0d0d' }}>
                          <span style={{ fontSize: 12, color: '#ccc' }}>{d.nombre}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {d.estado === 'actualizado' && (
                              <span style={{ fontSize: 11, color: '#555' }}>{fmt(d.anterior)} → <span style={{ color: '#22c55e' }}>{fmt(d.nuevo)}</span></span>
                            )}
                            <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${colorEstado[d.estado]}20`, color: colorEstado[d.estado] }}>
                              {labelEstado[d.estado]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button className="btn-ghost" onClick={() => setModalArchivo(null)} style={{ width: '100%', padding: '11px', fontSize: 13 }}>Cerrar</button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Nuevo proveedor ═════════════════════════════════════════════ */}
      {showNuevoProv && (
        <div style={{ position: 'fixed', inset: 0, background: '#000000cc', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNuevoProv(false); }}>
          <div className="fade-up" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Nuevo proveedor</div>

            {errorNuevoProv && <div style={{ background: '#2d1515', border: '1px solid #ef444430', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#f87171' }}>⚠️ {errorNuevoProv}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={S.label}>ID (sin espacios, minúsculas)</label>
                <input value={nuevoProv.id} onChange={(e) => setNuevoProv({ ...nuevoProv, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} placeholder="ej: fusion, tecneco, darmet" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={S.label}>Nombre visible</label>
                <input value={nuevoProv.nombre} onChange={(e) => setNuevoProv({ ...nuevoProv, nombre: e.target.value })} placeholder="ej: Distribuidora Fusión" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={S.label}>Margen por defecto (%)</label>
                <input type="number" min={0} max={200} value={nuevoProv.margen_default} onChange={(e) => setNuevoProv({ ...nuevoProv, margen_default: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={S.label}>Categoría por defecto</label>
                <select value={nuevoProv.categoria_default} onChange={(e) => setNuevoProv({ ...nuevoProv, categoria_default: e.target.value })} style={{ width: '100%' }}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn-ghost" onClick={() => setShowNuevoProv(false)} style={{ flex: 1 }}>Cancelar</button>
              <button className="btn-prim" onClick={crearProveedor} disabled={creandoProv} style={{ flex: 2, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>
                {creandoProv ? 'Guardando...' : '✓ CREAR PROVEEDOR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers de parsing (cliente) ─────────────────────────────────────────────

function detectarCabecera(json) {
  if (!json.length) return { headers: [], rows: [] };
  const keywords = ['cod', 'desc', 'nom', 'prec', 'valor', 'art', 'pvp', 'cost', 'precio', 'venta', 'stock', 'marca'];
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(30, json.length); i++) {
    const row = json[i];
    if (!row) continue;
    const cells = row.map((c) => String(c || '').trim());
    if (cells.filter(Boolean).length < 2) continue;
    let hits = 0;
    cells.forEach((t) => { if (keywords.some((k) => t.toLowerCase().includes(k))) hits++; });
    if (hits >= 2) { headerRowIdx = i; break; }
  }
  const headers = json[headerRowIdx].map((h) => String(h || '').trim());
  const rows = json.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== '' && c != null));
  return { headers, rows };
}

function autoMapear(columnas) {
  const mapeo = {};
  columnas.forEach((h, i) => {
    const hl = String(h).toLowerCase();
    if (hl.includes('cod') || hl === 'id')                                    mapeo[i] = 'codigo';
    else if (hl.includes('desc') || hl.includes('nom') || hl.includes('art')) mapeo[i] = 'nombre';
    else if (hl.includes('marc'))                                              mapeo[i] = 'marca';
    else if (hl.includes('costo') || hl.includes('cost'))                     mapeo[i] = 'precio_costo';
    else if (hl.includes('lista') || hl.includes('suger'))                    mapeo[i] = 'precio_lista';
    else if (hl.includes('venta') || hl.includes('pvp') || hl.includes('precio')) mapeo[i] = 'precio_costo';
    else if (hl.includes('stock'))                                             mapeo[i] = 'stock';
    else                                                                        mapeo[i] = 'ignorar';
  });
  return mapeo;
}

function generarPreview(filas, columnas, mapeo, margen) {
  const colByField = {};
  Object.entries(mapeo).forEach(([idx, field]) => { if (field !== 'ignorar') colByField[field] = Number(idx); });

  const margenNum = Number(margen) || 40;

  return filas.slice(0, 500).map((row) => {
    const nombre = colByField.nombre != null && row[colByField.nombre] != null ? String(row[colByField.nombre]).trim() : '';
    const codigo = colByField.codigo != null && row[colByField.codigo] != null ? String(row[colByField.codigo]).trim() : '';
    const marca  = colByField.marca  != null && row[colByField.marca]  != null ? String(row[colByField.marca]).trim()  : '';

    const rawCosto = colByField.precio_costo != null && row[colByField.precio_costo] != null
      ? String(row[colByField.precio_costo]).replace(/[^0-9.,]/g, '').replace(',', '.') : '';
    const rawLista = colByField.precio_lista != null && row[colByField.precio_lista] != null
      ? String(row[colByField.precio_lista]).replace(/[^0-9.,]/g, '').replace(',', '.') : '';

    const precio_costo = parseFloat(rawCosto) || 0;
    const precio_lista = parseFloat(rawLista) || 0;
    const precio_venta_calc = precio_costo > 0 ? Math.ceil(precio_costo * (1 + margenNum / 100)) : 0;

    return { codigo, nombre, marca, precio_costo, precio_lista, precio_venta_calc };
  }).filter((p) => p.nombre && p.precio_costo > 0);
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
