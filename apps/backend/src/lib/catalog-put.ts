/**
 * El rol ALMACEN puede editar datos del catálogo pero no cambiar el flag `activo`
 * (solo el administrador, vía PUT con `activo` true/false).
 */
export function effectiveCatalogoIsActive(
  role: string | undefined,
  bodyActivo: boolean | undefined,
  existingIsActive: boolean,
): boolean {
  if (role === "ALMACEN") {
    return existingIsActive;
  }
  if (bodyActivo !== undefined) {
    return bodyActivo;
  }
  return existingIsActive;
}
