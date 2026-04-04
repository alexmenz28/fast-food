export const SESSION_KEY = "fastfood_session";

export type Sesion = {
  token: string;
  nombreUsuario: string;
  nombreCompleto: string;
  rol: "ADMINISTRADOR" | "ALMACEN" | "SUPERVISOR";
};

export function parseSesion(raw: string | null): Sesion | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (
      o &&
      typeof o === "object" &&
      "token" in o &&
      typeof (o as Sesion).token === "string" &&
      "rol" in o &&
      typeof (o as Sesion).nombreCompleto === "string"
    ) {
      const rol = (o as Sesion).rol;
      if (rol === "ADMINISTRADOR" || rol === "ALMACEN" || rol === "SUPERVISOR") {
        return o as Sesion;
      }
    }
  } catch {
    /* sesion antigua o corrupta */
  }
  return null;
}
