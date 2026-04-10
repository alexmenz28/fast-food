import type { FastifyInstance, FastifyRequest } from "fastify";
import * as jose from "jose";
import { API_VERSION_PATH } from "../lib/constants.js";
import { jwtSecretKey } from "../lib/jwt.js";

const LOGIN_PATH = `${API_VERSION_PATH}/auth/login`;

function rutaPublica(method: string, pathSinQuery: string): boolean {
  const healthPath = pathSinQuery === "/health" || pathSinQuery === "/health/db";
  if (healthPath && (method === "GET" || method === "HEAD")) {
    return true;
  }
  if (method === "POST" && pathSinQuery === LOGIN_PATH) {
    return true;
  }
  return false;
}

export function registerAuthGate(app: FastifyInstance): void {
  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    if (request.method === "OPTIONS") {
      return;
    }
    const path = (request.url.split("?")[0] ?? "") as string;
    if (rutaPublica(request.method, path)) {
      return;
    }

    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      reply.code(401);
      return reply.send({ ok: false, error: "No autorizado. Inicia sesion." });
    }
    const token = header.slice(7);
    let role: string;
    try {
      const { payload } = await jose.jwtVerify(token, jwtSecretKey, { algorithms: ["HS256"] });
      role = String(payload.role ?? "");
      const userId = String(payload.sub ?? "");
      if (!role || !userId) {
        throw new Error("payload");
      }
      request.authUser = { userId, role };
    } catch {
      reply.code(401);
      return reply.send({ ok: false, error: "Sesion invalida o expirada." });
    }

    if (request.method !== "GET" && role === "SUPERVISOR") {
      reply.code(403);
      return reply.send({ ok: false, error: "El rol supervisor solo tiene permisos de consulta." });
    }

    if (request.method === "DELETE" && role === "ALMACEN") {
      reply.code(403);
      return reply.send({
        ok: false,
        error: "Solo el administrador puede desactivar registros del catalogo.",
      });
    }
  });
}
