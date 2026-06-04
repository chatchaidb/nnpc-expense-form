import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  ensureUserAccount,
  getCurrentUserAccount,
  type AccountRole,
} from "@/lib/query/accounts";

export function jsonError(message: string, status: number) {
  return Response.json({ message }, { status });
}

export async function requireSession({
  allowUnapproved = false,
}: {
  allowUnapproved?: boolean;
} = {}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new Response(JSON.stringify({ message: "Unauthorized" }), {
      headers: { "Content-Type": "application/json" },
      status: 401,
    });
  }

  const account = await ensureUserAccount({
    email: session.user.email,
    name: session.user.name,
    userId: session.user.id,
  });

  if (!allowUnapproved && account.accessStatus !== "approved") {
    throw new Response(JSON.stringify({ message: "Access not approved" }), {
      headers: { "Content-Type": "application/json" },
      status: account.accessStatus === "disabled" ? 403 : 423,
    });
  }

  return { account, session };
}

export async function requireRoles(roles: AccountRole[]) {
  const { session } = await requireSession();
  const freshAccount = await getCurrentUserAccount(session.user.id);

  if (!roles.includes(freshAccount.role)) {
    throw new Response(JSON.stringify({ message: "Forbidden" }), {
      headers: { "Content-Type": "application/json" },
      status: 403,
    });
  }

  return { account: freshAccount, session };
}

export async function withApiErrors(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Unexpected server error", 500);
  }
}
