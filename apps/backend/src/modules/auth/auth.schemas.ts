import { z } from "zod";

export const loginBodySchema = z.object({
  usuario: z.string().trim().min(1).max(60),
  contrasena: z.string().min(1).max(128),
});
