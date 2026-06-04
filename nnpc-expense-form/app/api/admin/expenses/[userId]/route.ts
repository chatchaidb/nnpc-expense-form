import { requireRoles, withApiErrors } from "@/lib/api-session";
import { getAdminExpenseUserDetail, normalizeAdminPeriod } from "@/lib/query/admin-expenses";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return withApiErrors(async () => {
    await requireRoles(["admin", "central_admin"]);
    const { userId } = await params;
    const url = new URL(request.url);
    const period = normalizeAdminPeriod(url.searchParams.get("period"));

    return Response.json(await getAdminExpenseUserDetail(period, userId));
  });
}
