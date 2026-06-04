import { requireSession, withApiErrors } from "@/lib/api-session";

export async function GET() {
  return withApiErrors(async () => {
    const { account } = await requireSession({ allowUnapproved: true });
    return Response.json(account);
  });
}
