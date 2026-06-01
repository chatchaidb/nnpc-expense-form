export const LOCAL_DEVELOPMENT_ACCESS_TOKEN = "local-development-access-token";
export const LOCAL_DEVELOPMENT_USER_EMAIL = "local-reviewer@nnpc.local";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function isLocalDevelopmentAccessToken(accessToken: string) {
  return accessToken === LOCAL_DEVELOPMENT_ACCESS_TOKEN;
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function readLocalStorageJson<T>(key: string, fallback: T) {
  if (!isBrowser()) {
    return fallback;
  }

  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return fallback;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function writeLocalStorageJson<T>(key: string, value: T) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
