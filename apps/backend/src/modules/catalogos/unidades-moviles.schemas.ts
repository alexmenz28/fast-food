import { z } from "zod";

export const unidadMovilCrearSchema = z.object({
  zona: z.string().trim().min(2).max(120),
  estado: z.enum(["ACTIVA", "MANTENIMIENTO", "FUERA_DE_SERVICIO"]).optional(),
  idVendedor: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});

export const unidadMovilActualizarSchema = z.object({
  zona: z.string().trim().min(2).max(120),
  estado: z.enum(["ACTIVA", "MANTENIMIENTO", "FUERA_DE_SERVICIO"]).optional(),
  idVendedor: z.string().uuid().nullable().optional(),
  activo: z.boolean().optional(),
});
