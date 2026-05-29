import { createContext, useContext, useState, useEffect } from 'react';
import {
  leerSesion,
  guardarSesion,
  limpiarSesion,
  validarCredenciales,
  esAdmin,
} from '../lib/auth';
import LoginScreen from './LoginScreen';

// ─── Context ──────────────────────────────────────────────────────────────────
// Provee { sesion, onCambiarUsuario } a cualquier componente hijo.
const AuthContext = createContext(null);

/**
 * Hook para consumir la sesión activa dentro de una página protegida.
 * @returns {{ sesion: object, onCambiarUsuario: function }}
 */
export function useAuth() {
  return useContext(AuthContext);
}

// ─── AuthGuard ────────────────────────────────────────────────────────────────
/**
 * Envuelve una página y la protege con login.
 * - Si hay sesión válida → renderiza children con contexto de autenticación.
 * - Si requiereAdmin=true y el usuario no es admin → muestra pantalla de acceso denegado.
 * - Si no hay sesión → muestra LoginScreen.
 *
 * @param {string}           pantalla      - Nombre de la pantalla protegida (ej: "Caja").
 * @param {boolean}          requiereAdmin - Si true, solo usuarios con rol=admin pueden acceder.
 * @param {React.ReactNode}  children      - Contenido de la página protegida.
 */
export default function AuthGuard({ children, pantalla = 'Sistema', requiereAdmin = false }) {
  const [sesion, setSesion]         = useState(null);
  const [checking, setChecking]     = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginando, setLoginando]   = useState(false);

  // Verificar sesión solo en el cliente (localStorage no existe en SSR)
  useEffect(() => {
    setSesion(leerSesion());
    setChecking(false);
  }, []);

  async function handleLogin(usuario, password) {
    setLoginando(true);
    setLoginError('');
    try {
      const user = await validarCredenciales(usuario, password);
      if (user) {
        guardarSesion(user);
        setSesion(leerSesion()); // leer el objeto recién guardado con expira
        setLoginError('');
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    } catch {
      setLoginError('Error al conectar. Intentá de nuevo.');
    } finally {
      setLoginando(false);
    }
  }

  function handleCambiarUsuario() {
    limpiarSesion();
    setSesion(null);
    setLoginError('');
  }

  // Mientras verifica localStorage, no renderizar nada (evita flash)
  if (checking) return null;

  // Sin sesión → mostrar pantalla de login
  if (!sesion) {
    return (
      <LoginScreen
        pantalla={pantalla}
        onLogin={handleLogin}
        error={loginError}
        loginando={loginando}
      />
    );
  }

  // Con sesión pero sin permiso de admin → pantalla de acceso denegado
  if (requiereAdmin && !esAdmin(sesion)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Barlow Condensed', Arial, sans-serif",
        flexDirection: 'column',
        gap: 20,
      }}>
        <div style={{ fontSize: 48 }}>🚫</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>
          ACCESO DENEGADO
        </div>
        <div style={{ fontSize: 14, color: '#555', textAlign: 'center', maxWidth: 320 }}>
          Esta sección requiere permisos de administrador.<br />
          Estás logueado como <strong style={{ color: '#aaa' }}>{sesion.nombre}</strong>.
        </div>
        <button
          onClick={handleCambiarUsuario}
          style={{
            marginTop: 10,
            background: '#111',
            border: '1px solid #333',
            borderRadius: 10,
            padding: '10px 24px',
            color: '#888',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          ← CAMBIAR USUARIO
        </button>
      </div>
    );
  }

  // Con sesión válida → proveer contexto y renderizar la página
  return (
    <AuthContext.Provider value={{ sesion, onCambiarUsuario: handleCambiarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}
