import { requireRoles, withApiErrors } from "@/lib/api-session";
import {
  adminManageUserAccount,
  getAdminUserManagement,
  type AssignableRole,
} from "@/lib/query/accounts";

export async function GET() {
  return withApiErrors(async () => {
    await requireRoles(["admin", "central_admin"]);
    return Response.json(await getAdminUserManagement());
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireRoles(["admin", "central_admin"]);
    const body = (await request.json()) as {
      action?: "approve" | "delete" | "disable" | "set_role";
      role?: AssignableRole;
      targetUserId?: string;
    };

    if (!body.action || !body.targetUserId) {
      return Response.json({ message: "Action and target user are required." }, { status: 400 });
    }

    return Response.json(
      await adminManageUserAccount({
        action: body.action,
        actorUserId: session.user.id,
        role: body.role,
        targetUserId: body.targetUserId,
      }),
    );
  });
}
