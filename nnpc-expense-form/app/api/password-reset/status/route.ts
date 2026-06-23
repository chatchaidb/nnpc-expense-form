import { getPasswordResetStatus } from "@/lib/query/password-reset";
import { withApiErrors } from "@/lib/api-session";

export async function GET(request: Request) {
  return withApiErrors(async () => {
    const url = new URL(request.url);
    return Response.json(await getPasswordResetStatus(url.searchParams.get("email") ?? ""));
  });
}
