import { requireSession, withApiErrors } from "@/lib/api-session";
import { getUserProfile, upsertUserProfile } from "@/lib/query/profile";

export async function GET() {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    return Response.json(await getUserProfile(session.user.id));
  });
}

export async function PUT(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const body = (await request.json()) as { department?: string; fullName?: string };

    return Response.json(
      await upsertUserProfile({
        department: body.department ?? "",
        fullName: body.fullName ?? "",
        userId: session.user.id,
      }),
    );
  });
}
