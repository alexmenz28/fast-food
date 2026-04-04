/**
 * Base del API versionado.
 * - Desarrollo: Vite proxy `/api` → backend; las peticiones van a `/api/v1/...` (sin CORS).
 * - Producción: `VITE_API_URL` = origen del servidor (sin barra final), p. ej. `https://api.midominio.com`.
 */
const API_ORIGIN = import.meta.env.DEV
  ? "/api"
  : (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:3000";

export const API_VERSION = "v1";

/** URL base para todos los recursos REST versionados (p. ej. `/api/v1` o `https://host/v1`). */
export const API_V1_URL = `${API_ORIGIN}/${API_VERSION}`;
