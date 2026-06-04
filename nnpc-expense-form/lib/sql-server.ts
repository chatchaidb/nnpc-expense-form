import "server-only";

export type SqlServerConnection = {
  database: string;
  password: string;
  port: number;
  server: string;
  user: string;
};

export function readSqlServerConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for SQL Server.");
  }

  return connectionString;
}

export function parseSqlServerConnection(connectionString: string) {
  const [, rawServer = "", rawProperties = ""] =
    connectionString.match(/^sqlserver:\/\/([^;]+);?(.*)$/i) ?? [];
  const [rawHost = "", rawPort] = rawServer.split(":");
  const properties = Object.fromEntries(
    rawProperties
      .split(";")
      .filter(Boolean)
      .map((property) => {
        const separatorIndex = property.indexOf("=");

        if (separatorIndex === -1) {
          return [property, ""];
        }

        return [
          property.slice(0, separatorIndex).toLowerCase(),
          decodeURIComponent(property.slice(separatorIndex + 1)),
        ];
      }),
  );

  return {
    database: properties.database ?? "",
    password: properties.password ?? "",
    port: Number(rawPort || properties.port || 1433),
    server: rawHost.replace(/\\[^\\]+$/, ""),
    user: properties.user ?? "",
  } satisfies SqlServerConnection;
}

export function getSqlServerConnection() {
  return parseSqlServerConnection(readSqlServerConnectionString());
}

export function getSqlServerConfig() {
  const connection = getSqlServerConnection();

  return {
    database: connection.database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    password: connection.password,
    port: connection.port,
    server: connection.server,
    user: connection.user,
  };
}
