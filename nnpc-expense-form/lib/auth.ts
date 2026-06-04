import { betterAuth } from "better-auth";
import { MssqlDialect } from "kysely";
import * as Tarn from "tarn";
import * as Tedious from "tedious";
import { nextCookies } from "better-auth/next-js";
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
            encrypt: connection.encrypt,
            port: connection.port,
            trustServerCertificate: connection.trustServerCertificate,
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
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "development-only-better-auth-secret-change-before-production",
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
});
