import { useState } from 'react';
import { HORA_CIERRE, getUsuariosParaLogin } from '../lib/auth';

// Genera iniciales y color de avatar a partir del nombre
function getAvatar(nombre) {
  const initials = nombre
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  // Paleta de colores para avatares
  const colors = [
    { bg: '#1d4ed8', light: '#93c5fd' },
    { bg: '#7c3aed', light: '#c4b5fd' },
    { bg: '#065f46', light: '#6ee7b7' },
    { bg: '#92400e', light: '#fcd34d' },
    { bg: '#9f1239', light: '#fda4af' },
  ];
  const idx = nombre.charCodeAt(0) % colors.length;
  return { initials, ...colors[idx] };
}

const PANTALLA_CONFIG = {
  Caja:       { icon: '🏧', sub: 'Panel de cobros y ventas' },
  Importador: { icon: '📂', sub: 'Importador de proveedores' },
  Dashboard:  { icon: '📊', sub: 'Dashboard de métricas' },
};

export default function LoginScreen({ pantalla = 'Sistema', onLogin, error }) {
  const usuarios = getUsuariosParaLogin();
  const [usuarioSel, setUsuarioSel] = useState(null);
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);

  const cfg = PANTALLA_CONFIG[pantalla] || { icon: '🔒', sub: pantalla };

  function seleccionar(u) {
    setUsuarioSel(u);
    setPassword('');
    setShowPass(false);
  }

  function volver() {
    setUsuarioSel(null);
    setPassword('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (usuarioSel) onLogin(usuarioSel.usuario, password);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Barlow Condensed', Arial, sans-serif",
      padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        input { outline: none; font-family: inherit; }
        input:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px #2563eb18 !important; }
        .user-card {
          cursor: pointer;
          transition: all 0.18s ease;
          border: 2px solid transparent;
        }
        .user-card:hover {
          border-color: #2563eb !important;
          background: #111 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px #0008;
        }
        .user-card:active { transform: scale(0.97) translateY(0); }
        .login-btn { transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { background: #2563eb !important; transform: translateY(-1px); box-shadow: 0 6px 20px #2563eb44; }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .show-btn:hover { color: #888 !important; }
        .back-btn:hover { color: #888 !important; background: #1a1a1a !important; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .slide-up { animation: slideUp 0.22s ease-out; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        .shake { animation: shake 0.3s ease-out; }
      `}</style>

      <div style={{
        background: 'linear-gradient(145deg, #141414, #0f0f0f)',
        border: '1px solid #1e1e1e',
        borderRadius: 24,
        padding: '44px 40px',
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        boxShadow: '0 30px 80px #00000090, 0 0 0 1px #ffffff05',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>{cfg.icon}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: 3, lineHeight: 1 }}>
            FB LUBRICENTRO
          </div>
          <div style={{ fontSize: 11, color: '#333', letterSpacing: 4, textTransform: 'uppercase', marginTop: 6 }}>
            {cfg.sub}
          </div>
        </div>

        {/* ── PASO 1: Selección de usuario ── */}
        {!usuarioSel && (
          <div className="slide-up">
            <div style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>
              Seleccioná tu usuario
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: usuarios.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 12,
            }}>
              {usuarios.map((u) => {
                const av = getAvatar(u.nombre);
                return (
                  <button
                    key={u.usuario}
                    className="user-card"
                    onClick={() => seleccionar(u)}
                    style={{
                      background: '#0f0f0f',
                      border: '2px solid #1e1e1e',
                      borderRadius: 16,
                      padding: '22px 16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: av.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      fontWeight: 800,
                      color: av.light,
                      letterSpacing: 1,
                      boxShadow: `0 4px 16px ${av.bg}66`,
                      flexShrink: 0,
                    }}>
                      {av.initials}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#ddd', letterSpacing: 0.5 }}>
                        {u.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: '#444', marginTop: 2, letterSpacing: 1 }}>
                        @{u.usuario}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PASO 2: Contraseña del usuario seleccionado ── */}
        {usuarioSel && (() => {
          const av = getAvatar(usuarioSel.nombre);
          return (
            <form className="slide-up" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Usuario seleccionado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: '#0f0f0f', borderRadius: 14, border: '1px solid #1e1e1e' }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: av.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  fontWeight: 800,
                  color: av.light,
                  flexShrink: 0,
                }}>
                  {av.initials}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{usuarioSel.nombre}</div>
                  <div style={{ fontSize: 11, color: '#444', letterSpacing: 1 }}>@{usuarioSel.usuario}</div>
                </div>
                <button
                  type="button"
                  className="back-btn"
                  onClick={volver}
                  title="Cambiar usuario"
                  style={{
                    background: 'none',
                    border: '1px solid #222',
                    borderRadius: 8,
                    padding: '5px 10px',
                    color: '#555',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    letterSpacing: 0.5,
                  }}
                >
                  ← Cambiar
                </button>
              </div>

              {/* Contraseña */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    placeholder="••••••••"
                    style={{
                      background: '#0c0c0c',
                      border: '1px solid #222',
                      borderRadius: 12,
                      padding: '14px 46px 14px 16px',
                      color: '#fff',
                      fontSize: 16,
                      width: '100%',
                      letterSpacing: 2,
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                  />
                  <button
                    type="button"
                    className="show-btn"
                    onClick={() => setShowPass((s) => !s)}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 17,
                      color: '#555',
                      padding: 4,
                      transition: 'color 0.15s',
                    }}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="shake" key={error} style={{
                  background: '#ef444415',
                  border: '1px solid #ef444435',
                  borderRadius: 10,
                  padding: '11px 16px',
                  color: '#ef4444',
                  fontSize: 13,
                  textAlign: 'center',
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={!password}
                className="login-btn"
                style={{
                  background: !password ? '#1a1a1a' : '#1d4ed8',
                  border: 'none',
                  borderRadius: 12,
                  padding: '15px',
                  color: !password ? '#333' : '#fff',
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: !password ? 'not-allowed' : 'pointer',
                  letterSpacing: 2,
                  fontFamily: 'inherit',
                  marginTop: 4,
                }}
              >
                ACCEDER
              </button>
            </form>
          );
        })()}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#222', letterSpacing: 0.5 }}>
          Sesión válida hasta las {HORA_CIERRE}:00 hs del día actual
        </div>
      </div>
    </div>
  );
}
