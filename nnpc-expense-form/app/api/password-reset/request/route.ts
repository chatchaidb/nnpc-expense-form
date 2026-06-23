import { requestPasswordReset } from "@/lib/query/password-reset";
import { withApiErrors } from "@/lib/api-session";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = (await request.json()) as {
      email?: string;
    };

    return Response.json(await requestPasswordReset(body.email ?? ""));
  });
}
