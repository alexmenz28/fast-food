import { z } from "zod";

/** Body POST /v1/inventario/ingresos — ingreso al almacén central (HU4). */
export const inventarioIngresoSchema = z.object({
  idProducto: z.string().uuid(),
  cantidad: z.coerce.number().positive().max(1_000_000),
  /** Fecha/hora interpretable por `Date`; si se omite, usa el momento del servidor. */
  fechaHora: z.string().max(40).optional(),
  nota: z.string().max(2000).optional(),
});

/** Body PATCH .../stock/:idProducto/minimo */
export const inventarioMinimoSchema = z.object({
  cantidadMinima: z.coerce.number().min(0).max(1_000_000),
});

export const inventarioStockQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
  idCategoria: z.coerce.number().int().positive().optional(),
});
