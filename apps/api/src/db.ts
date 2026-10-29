import { PrismaClient } from "@prisma/client";

const globalPrisma = globalThis as typeof globalThis & { beApiPrisma?: PrismaClient };

export const prisma =
  globalPrisma.beApiPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalPrisma.beApiPrisma = prisma;
