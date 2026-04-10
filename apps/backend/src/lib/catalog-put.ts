/**
 * Regla de negocio compartida por PUT de catálogos (productos, vendedores, unidades móviles).
 *
 * - ALMACEN: el cuerpo puede traer `activo`, pero se ignora; queda el valor ya guardado en BD.
 * - ADMINISTRADOR (u otro rol distinto de ALMACEN): si envía `activo`, se aplica; si no, se mantiene el anterior.
 *
 * Relación: `productos.routes.ts` (y similares) llaman a esta función antes de `prisma.producto.update`.
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
