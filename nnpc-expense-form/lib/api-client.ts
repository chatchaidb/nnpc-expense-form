export const SESSION_EXPIRED_MESSAGE = "Session expired. Log in again.";

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Request failed.");
  }

  return (await response.json()) as T;
}
