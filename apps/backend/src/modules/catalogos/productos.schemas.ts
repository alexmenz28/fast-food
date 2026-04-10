/**
 * Contrato JSON del cuerpo de petición para productos (crear / actualizar).
 *
 * La clasificación del producto es siempre un `idCategoria` que referencia filas activas
 * de `ProductCategory`. Nuevas categorías se agregan solo en base de datos (o seed);
 * no hace falta tocar código ni enums en TypeScript.
 *
 * - `productos.routes.ts` valida con Zod y comprueba que la categoría exista y esté activa.
 * - `idUnidadMedida` es la FK hacia `MeasureUnit`.
 */
import { z } from "zod";

/** Body POST /v1/productos — el código interno (P001, …) lo genera el backend. */
export const productoCrearSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  /** FK a `categoria_producto.id`; debe existir y `activo = true`. */
  idCategoria: z.coerce.number().int().positive(),
  idUnidadMedida: z.coerce.number().int().positive(),
  /** Si no se envía, en creación el route usa `true` por defecto. */
  activo: z.boolean().optional(),
});

/** Body PUT /v1/productos/:id — el `activo` puede quedar sujeto a rol (ver `catalog-put.ts`). */
export const productoActualizarSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  idCategoria: z.coerce.number().int().positive(),
  idUnidadMedida: z.coerce.number().int().positive(),
  activo: z.boolean().optional(),
});
