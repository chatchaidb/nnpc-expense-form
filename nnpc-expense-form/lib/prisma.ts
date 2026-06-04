import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaMssql } from "@prisma/adapter-mssql";
import { getSqlServerConfig } from "@/lib/sql-server";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaMssql(getSqlServerConfig()),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
