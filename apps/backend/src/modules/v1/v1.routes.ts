import type { FastifyPluginAsync } from "fastify";
import { authRoutes } from "../auth/auth.routes.js";
import { productosRoutes } from "../catalogos/productos.routes.js";
import { unidadesMedidaRoutes } from "../catalogos/unidades-medida.routes.js";
import { unidadesMovilesRoutes } from "../catalogos/unidades-moviles.routes.js";
import { vendedoresRoutes } from "../catalogos/vendedores.routes.js";

/**
 * API versionada: todos los recursos bajo `/v1/...`.
 * Nuevos módulos del caso de estudio se registran aquí (p. ej. inventario, abastecimiento).
 */
export const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(productosRoutes, { prefix: "/productos" });
  await app.register(vendedoresRoutes, { prefix: "/vendedores" });
  await app.register(unidadesMovilesRoutes, { prefix: "/unidades-moviles" });
  await app.register(unidadesMedidaRoutes, { prefix: "/unidades-medida" });
};
