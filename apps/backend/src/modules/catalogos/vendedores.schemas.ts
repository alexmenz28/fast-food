import { z } from "zod";

const soloDigitosTelefono = z
  .string()
  .trim()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(7).max(15));

export const vendedorBodySchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(120),
  documento: z.string().trim().min(4).max(30),
  telefono: soloDigitosTelefono,
  activo: z.boolean().optional(),
});
