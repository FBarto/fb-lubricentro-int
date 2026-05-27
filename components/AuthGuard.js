import { createContext, useContext, useState, useEffect } from 'react';
import {
  leerSesion,
  guardarSesion,
  limpiarSesion,
  validarCredenciales,
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
 * - Si no → muestra LoginScreen.
 *
 * @param {string} pantalla - Nombre de la pantalla protegida (ej: "Caja").
 * @param {React.ReactNode} children - Contenido de la página protegida.
 */
export default function AuthGuard({ children, pantalla = 'Sistema' }) {
  const [sesion, setSesion]       = useState(null);
  const [checking, setChecking]   = useState(true);
  const [loginError, setLoginError] = useState('');

  // Verificar sesión solo en el cliente (localStorage no existe en SSR)
  useEffect(() => {
    setSesion(leerSesion());
    setChecking(false);
  }, []);

  function handleLogin(usuario, password) {
    const user = validarCredenciales(usuario, password);
    if (user) {
      guardarSesion(user);
      setSesion(leerSesion()); // leer el objeto recién guardado con expira
      setLoginError('');
    } else {
      setLoginError('Usuario o contraseña incorrectos');
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
      />
    );
  }

  // Con sesión → proveer contexto y renderizar la página
  return (
    <AuthContext.Provider value={{ sesion, onCambiarUsuario: handleCambiarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}
