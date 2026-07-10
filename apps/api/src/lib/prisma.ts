import { PrismaClient } from "@prisma/client";

// Single shared Prisma client — import this everywhere instead of
// instantiating PrismaClient again.
export const prisma = new PrismaClient();
