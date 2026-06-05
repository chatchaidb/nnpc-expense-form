const TECHNICAL_ERROR_PATTERNS = [
  "database",
  "DATABASE_URL",
  "fetch failed",
  "network",
  "Request failed",
  "SQL Server",
  "ECONN",
  "timeout",
  "Prisma",
  "Supabase",
  "Better Auth",
];

export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (!message.trim()) {
    return fallback;
  }

  if (normalized.includes("session expired") || normalized.includes("unauthorized")) {
    return "Your session has expired. Please log in again.";
  }

  if (
    normalized.includes("invalid email") ||
    normalized.includes("invalid password") ||
    normalized.includes("invalid credentials")
  ) {
    return "The email or password does not look right. Please check both and try again.";
  }

  if (normalized.includes("password") && normalized.includes("8")) {
    return "Please use a password with at least 8 characters.";
  }

  if (normalized.includes("approved access required") || normalized.includes("admin access required")) {
    return "Your account is not allowed to open this page. Please contact your admin if you need access.";
  }

  if (normalized.includes("account record") || normalized.includes("account status")) {
    return "We could not check your account status yet. Please wait a moment, then try again.";
  }

  if (TECHNICAL_ERROR_PATTERNS.some((pattern) => message.includes(pattern))) {
    return fallback;
  }

  return message;
}
