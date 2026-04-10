import { z } from "zod";

const fechaYYYYMMDD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.");

const placaRequerida = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? "" : String(v).trim()),
  z.string().min(1, "La placa es obligatoria.").max(20, "La placa admite como máximo 20 caracteres."),
);

const descripcionOpcional = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : String(v).trim().slice(0, 255) || null),
  z.union([z.string().max(255), z.null()]),
);

const baseUnidad = {
  placa: placaRequerida,
  descripcion: descripcionOpcional,
  idEstadoOperativo: z.coerce.number().int().positive(),
  idVendedor: z.union([z.string().uuid(), z.null()]).optional(),
  fechaInicioAsignacion: fechaYYYYMMDD.optional(),
  fechaFinAsignacion: fechaYYYYMMDD.optional(),
  activo: z.boolean().optional(),
};

/**
 * `placa` obligatoria (1–20 caracteres). `idEstadoOperativo` → `catalogo_estado_unidad_movil` (activo).
 * Zona por salida solo en **jornada**. Fechas: si hay `fechaFinAsignacion`, debe existir inicio; fin ≥ inicio.
 * Con `idVendedor`: `fechaInicioAsignacion` obligatoria.
 */
function refinamientoFechasAsignacion(
  data: {
    fechaInicioAsignacion?: string;
    fechaFinAsignacion?: string;
    idVendedor?: string | null;
  },
  ctx: z.RefinementCtx,
) {
  if (data.fechaFinAsignacion && !data.fechaInicioAsignacion) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Si indicas fecha de fin de asignación, debes indicar la fecha de inicio.",
      path: ["fechaInicioAsignacion"],
    });
  }
  if (data.fechaInicioAsignacion && data.fechaFinAsignacion) {
    if (data.fechaFinAsignacion < data.fechaInicioAsignacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha fin de asignación no puede ser anterior a la de inicio.",
        path: ["fechaFinAsignacion"],
      });
    }
  }
  if (data.idVendedor) {
    if (!data.fechaInicioAsignacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Con vendedor asignado, la fecha de inicio de la asignación es obligatoria.",
        path: ["fechaInicioAsignacion"],
      });
    }
  }
}

export const unidadMovilCrearSchema = z
  .object(baseUnidad)
  .superRefine((data, ctx) => {
    refinamientoFechasAsignacion(data, ctx);
  });

export const unidadMovilActualizarSchema = z
  .object(baseUnidad)
  .superRefine((data, ctx) => {
    refinamientoFechasAsignacion(data, ctx);
  });
