import { useState } from 'react';
import { HORA_CIERRE } from '../lib/auth';

const PANTALLA_CONFIG = {
  Caja:        { icon: '🏧', sub: 'Panel de cobros y ventas' },
  Importador:  { icon: '📂', sub: 'Importador de listas de proveedores' },
  Dashboard:   { icon: '📊', sub: 'Dashboard de métricas' },
};

export default function LoginScreen({ pantalla = 'Sistema', onLogin, error }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const cfg = PANTALLA_CONFIG[pantalla] || { icon: '🔒', sub: pantalla };

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
        input { outline: none; transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit; }
        input:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px #2563eb18 !important; }
        .login-btn { transition: all 0.2s; }
        .login-btn:hover:not(:disabled) { background: #2563eb !important; transform: translateY(-1px); box-shadow: 0 6px 20px #2563eb44; }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .show-btn:hover { color: #888 !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .login-card { animation: fadeIn 0.25s ease-out; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        .shake { animation: shake 0.3s ease-out; }
      `}</style>

      <div className="login-card" style={{
        background: 'linear-gradient(145deg, #141414, #0f0f0f)',
        border: '1px solid #1e1e1e',
        borderRadius: 24,
        padding: '48px 44px',
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        boxShadow: '0 30px 80px #00000090, 0 0 0 1px #ffffff05',
      }}>

        {/* Logo / Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 48 }}>{cfg.icon}</div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: 3, lineHeight: 1 }}>
              FB LUBRICENTRO
            </div>
            <div style={{ fontSize: 11, color: '#333', letterSpacing: 4, textTransform: 'uppercase', marginTop: 6 }}>
              {cfg.sub}
            </div>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); onLogin(usuario, password); }}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          {/* Usuario */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, color: '#444', letterSpacing: 3, textTransform: 'uppercase' }}>
              Usuario
            </label>
            <input
              id="login-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="admin"
              style={{
                background: '#0c0c0c',
                border: '1px solid #222',
                borderRadius: 12,
                padding: '14px 16px',
                color: '#fff',
                fontSize: 15,
                width: '100%',
              }}
            />
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
                style={{
                  background: '#0c0c0c',
                  border: '1px solid #222',
                  borderRadius: 12,
                  padding: '14px 46px 14px 16px',
                  color: '#fff',
                  fontSize: 15,
                  width: '100%',
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
            disabled={!usuario || !password}
            className="login-btn"
            style={{
              background: !usuario || !password ? '#1a1a1a' : '#1d4ed8',
              border: 'none',
              borderRadius: 12,
              padding: '15px',
              color: !usuario || !password ? '#333' : '#fff',
              fontSize: 16,
              fontWeight: 800,
              cursor: !usuario || !password ? 'not-allowed' : 'pointer',
              letterSpacing: 2,
              fontFamily: 'inherit',
              marginTop: 4,
            }}
          >
            ACCEDER
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#222', letterSpacing: 1 }}>
          Sesión válida hasta las {HORA_CIERRE}:00 hs del día actual
        </div>
      </div>
    </div>
  );
}
