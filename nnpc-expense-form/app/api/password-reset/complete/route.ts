import { completePasswordReset } from "@/lib/query/password-reset";
import { withApiErrors } from "@/lib/api-session";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const body = (await request.json()) as {
      confirmPassword?: string;
      email?: string;
      password?: string;
    };

    return Response.json(
      await completePasswordReset({
        confirmPassword: body.confirmPassword ?? "",
        email: body.email ?? "",
        password: body.password ?? "",
      }),
    );
  });
}
