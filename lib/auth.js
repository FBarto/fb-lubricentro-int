// ─── Configuración de jornada ─────────────────────────────────────────────────
// Hora de cierre de jornada (formato 24hs). La sesión expira a esta hora.
// Cambiar este valor si el horario del negocio varía.
export const HORA_CIERRE = 20; // 20:00 hs

// ─── Usuarios del sistema ─────────────────────────────────────────────────────
// Para agregar un usuario: copiar una línea y cambiar los valores.
// Para cambiar contraseña: editar el campo `password`.
// Para desactivar un usuario: eliminar la línea del array.
const USUARIOS = [
  { usuario: 'admin', password: 'fb2026', nombre: 'Admin' },
];

// ─── Validación de credenciales ───────────────────────────────────────────────
/**
 * Valida usuario y contraseña.
 * @returns {object|null} El objeto usuario si es válido, o null si no.
 */
export function validarCredenciales(usuario, password) {
  return (
    USUARIOS.find(
      (u) => u.usuario === usuario.trim() && u.password === password
    ) || null
  );
}

// ─── Clave de sesión (única por día) ──────────────────────────────────────────
function getSesionKey() {
  // La clave cambia cada día: "fb_auth_27/05/2026"
  // Esto garantiza que no haya sesiones de un día para el otro.
  const hoy = new Date().toLocaleDateString('es-AR');
  return `fb_auth_${hoy}`;
}

// ─── Guardar sesión ───────────────────────────────────────────────────────────
/**
 * Guarda la sesión en localStorage con tiempo de expiración = HORA_CIERRE del día actual.
 * @param {object} usuarioObj - Objeto devuelto por validarCredenciales().
 */
export function guardarSesion(usuarioObj) {
  try {
    const ahora = new Date();
    const expira = new Date(
      ahora.getFullYear(),
      ahora.getMonth(),
      ahora.getDate(),
      HORA_CIERRE,
      0,
      0,
    );
    const sesion = {
      usuario: usuarioObj.usuario,
      nombre: usuarioObj.nombre,
      loggedAt: ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      expira: expira.toISOString(),
    };
    localStorage.setItem(getSesionKey(), JSON.stringify(sesion));
  } catch {
    // localStorage no disponible (SSR o modo privado extremo) — ignorar silenciosamente
  }
}

// ─── Leer sesión ──────────────────────────────────────────────────────────────
/**
 * Lee la sesión del día actual y verifica que no haya expirado.
 * @returns {object|null} La sesión si es válida, o null si no existe o expiró.
 */
export function leerSesion() {
  try {
    const raw = localStorage.getItem(getSesionKey());
    if (!raw) return null;
    const sesion = JSON.parse(raw);
    if (!sesion?.expira) return null;
    // Si ya pasó la hora de cierre, limpiar y denegar
    if (new Date() > new Date(sesion.expira)) {
      limpiarSesion();
      return null;
    }
    return sesion;
  } catch {
    return null;
  }
}

// ─── Limpiar sesión ───────────────────────────────────────────────────────────
/**
 * Elimina la sesión del día actual (logout / cambio de usuario).
 */
export function limpiarSesion() {
  try {
    localStorage.removeItem(getSesionKey());
  } catch {}
}
