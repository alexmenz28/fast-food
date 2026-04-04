import { z } from "zod";

export const productoCrearSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipo: z.enum(["ALIMENTO", "BEBIDA", "INSUMO"]),
  idUnidadMedida: z.coerce.number().int().positive(),
  activo: z.boolean().optional(),
});

export const productoActualizarSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipo: z.enum(["ALIMENTO", "BEBIDA", "INSUMO"]),
  idUnidadMedida: z.coerce.number().int().positive(),
  activo: z.boolean().optional(),
});
