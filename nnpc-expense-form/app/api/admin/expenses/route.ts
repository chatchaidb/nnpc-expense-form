import { requireRoles, withApiErrors } from "@/lib/api-session";
import { getAdminExpenseDashboard, normalizeAdminPeriod } from "@/lib/query/admin-expenses";

export async function GET(request: Request) {
  return withApiErrors(async () => {
    await requireRoles(["admin", "central_admin"]);
    const url = new URL(request.url);
    const period = normalizeAdminPeriod(url.searchParams.get("period"));

    return Response.json(await getAdminExpenseDashboard(period));
  });
}
