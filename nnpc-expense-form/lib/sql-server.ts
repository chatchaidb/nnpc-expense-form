import "server-only";

export type SqlServerConnection = {
  database: string;
  encrypt: boolean;
  password: string;
  port: number;
  server: string;
  trustServerCertificate: boolean;
  user: string;
};

function readBooleanProperty(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export function readSqlServerConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for SQL Server.");
  }

  return connectionString;
}

export function getSqlServerConnectionString() {
  const connectionString = readSqlServerConnectionString();
  const connection = parseSqlServerConnection(connectionString);
  const hasEncrypt = /(^|;)encrypt=/i.test(connectionString);
  const hasTrustServerCertificate = /(^|;)trustServerCertificate=/i.test(connectionString);
  const options = [
    hasEncrypt ? null : `encrypt=${connection.encrypt}`,
    hasTrustServerCertificate ? null : `trustServerCertificate=${connection.trustServerCertificate}`,
  ].filter(Boolean);

  if (options.length === 0) {
    return connectionString;
  }

  return `${connectionString}${connectionString.endsWith(";") ? "" : ";"}${options.join(";")}`;
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
    encrypt: readBooleanProperty(properties.encrypt, false),
    password: properties.password ?? "",
    port: Number(rawPort || properties.port || 1433),
    server: rawHost.replace(/\\[^\\]+$/, ""),
    trustServerCertificate: readBooleanProperty(properties.trustservercertificate, true),
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
      encrypt: connection.encrypt,
      trustServerCertificate: connection.trustServerCertificate,
    },
    password: connection.password,
    port: connection.port,
    server: connection.server,
    user: connection.user,
  };
}
