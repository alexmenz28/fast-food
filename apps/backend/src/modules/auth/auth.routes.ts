import type { FastifyPluginAsync } from "fastify";
import bcrypt from "bcryptjs";
import { badRequest } from "../../lib/http.js";
import { firmarTokenJwt } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { loginBodySchema } from "./auth.schemas.js";

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return badRequest(reply, parsed.error.issues[0]?.message ?? "Datos invalidos.");
    }
    const usuarioNorm = parsed.data.usuario.trim().toUpperCase();
    const user = await prisma.usuario.findUnique({
      where: { username: usuarioNorm },
      include: { rol: true },
    });
    if (!user?.isActive || !user.rol.isActive) {
      reply.code(401);
      return { ok: false, error: "Usuario o contrasena incorrectos." };
    }
    const okPass = await bcrypt.compare(parsed.data.contrasena, user.passwordHash);
    if (!okPass) {
      reply.code(401);
      return { ok: false, error: "Usuario o contrasena incorrectos." };
    }

    const token = await firmarTokenJwt({
      role: user.rol.name,
      usuario: user.username,
      nombreCompleto: user.fullName,
      sub: user.id,
    });

    return {
      ok: true,
      data: {
        token,
        usuario: {
          id: user.id,
          nombreUsuario: user.username,
          nombreCompleto: user.fullName,
          rol: user.rol.name,
        },
      },
    };
  });

  app.get("/me", async (request, reply) => {
    const auth = request.authUser;
    if (!auth) {
      reply.code(401);
      return { ok: false, error: "No autenticado." };
    }
    const user = await prisma.usuario.findUnique({
      where: { id: auth.userId },
      include: { rol: true },
    });
    if (!user?.isActive || !user.rol.isActive) {
      reply.code(401);
      return { ok: false, error: "Usuario inactivo." };
    }
    return {
      ok: true,
      data: {
        id: user.id,
        nombreUsuario: user.username,
        nombreCompleto: user.fullName,
        rol: user.rol.name,
      },
    };
  });
};
