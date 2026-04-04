import type { Sesion } from "./session";

export function etiquetaRol(rol: Sesion["rol"]) {
  if (rol === "ADMINISTRADOR") return "Administrador";
  if (rol === "ALMACEN") return "Encargado de almacen";
  return "Supervisor de operaciones";
}

/** Administrador: todo. Almacen: alta y edicion, sin eliminar. Supervisor: solo lectura. */
export function puedeCrearEditar(rol: Sesion["rol"]): boolean {
  return rol === "ADMINISTRADOR" || rol === "ALMACEN";
}

/** Marcar/desmarcar «activo en catálogo» en el formulario de edición; solo administrador. */
export function puedeCambiarActivoCatalogo(rol: Sesion["rol"]): boolean {
  return rol === "ADMINISTRADOR";
}
