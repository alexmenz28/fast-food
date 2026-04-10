import { z } from "zod";
import { mensajeErrorHorarioJornada } from "./jornada-horario.js";

const uuid = z.string().uuid();
const fechaOperacion = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fechaOperacion debe ser YYYY-MM-DD.");
const horaHHmm = z
  .string()
  .regex(
    /^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/,
    "La hora debe ser HH:mm o HH:mm:ss en 24 h (ej. 20:00 o 03:00).",
  );

/** Body POST /v1/jornadas — planificación de jornada antes del abastecimiento (HU5). */
export const jornadaCrearSchema = z
  .object({
    idUnidad: uuid,
    idVendedor: uuid,
    idZona: uuid,
    fechaOperacion: fechaOperacion,
    horaInicio: horaHHmm,
    horaFin: horaHHmm,
  })
  .superRefine((data, ctx) => {
    const msg = mensajeErrorHorarioJornada(data.horaInicio, data.horaFin);
    if (msg) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ["horaFin"] });
    }
  });

const lineaAbastecimiento = z.object({
  idProducto: uuid,
  cantidad: z.coerce.number().positive().max(1_000_000),
});

/** Body POST /v1/abastecimientos — entrega desde almacén central con descuento atómico de stock. */
export const abastecimientoRegistrarSchema = z.object({
  idJornada: uuid,
  lineas: z.array(lineaAbastecimiento).min(1).max(200),
  nota: z.string().max(2000).optional(),
  entregadoEn: z.string().max(40).optional(),
});

export const jornadasQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
  pendienteAbastecimiento: z.preprocess(
    (v) => (v === "true" || v === true ? true : v === "false" || v === false ? false : undefined),
    z.boolean().optional(),
  ),
});

export const abastecimientosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(8),
});

export const idParamSchema = z.object({
  id: uuid,
});
