/** Cliente ORM singleton: usado por routes, services y seeds; apunta al esquema `prisma/schema.prisma`. */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
