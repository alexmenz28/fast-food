import cors from "@fastify/cors";
import Fastify from "fastify";
import { API_VERSION_PATH } from "./lib/constants.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { v1Routes } from "./modules/v1/v1.routes.js";
import { registerAuthGate } from "./plugins/auth-gate.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  registerAuthGate(app);

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: API_VERSION_PATH });

  return app;
}
