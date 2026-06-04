import { betterAuth } from "better-auth";
import { MssqlDialect } from "kysely";
import * as Tarn from "tarn";
import * as Tedious from "tedious";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { getSqlServerConnection } from "@/lib/sql-server";

function createMssqlDialect() {
  const connection = getSqlServerConnection();

  return new MssqlDialect({
    tarn: {
      ...Tarn,
      options: {
        max: 10,
        min: 0,
      },
    },
    tedious: {
      ...Tedious,
      connectionFactory: () =>
        new Tedious.Connection({
          authentication: {
            options: {
              password: connection.password,
              userName: connection.user,
            },
            type: "default",
          },
          options: {
            database: connection.database,
            encrypt: true,
            port: connection.port,
            trustServerCertificate: true,
          },
          server: connection.server,
        }),
    },
  });
}

export const auth = betterAuth({
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  appName: "NNPC Daily Expense",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: {
    dialect: createMssqlDialect(),
    type: "mssql",
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.userAccount.upsert({
            create: {
              accessStatus: "pending",
              displayName: user.name || user.email,
              email: user.email,
              role: "user",
              userId: user.id,
            },
            update: {
              displayName: user.name || user.email,
              email: user.email,
            },
            where: {
              userId: user.id,
            },
          });
        },
      },
      update: {
        after: async (user) => {
          if (!user.id) {
            return;
          }

          await prisma.userAccount.updateMany({
            data: {
              displayName: user.name || undefined,
              email: user.email || undefined,
            },
            where: {
              userId: user.id,
            },
          });
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-better-auth-secret-change-before-production",
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});
