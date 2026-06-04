import { requireSession, withApiErrors } from "@/lib/api-session";
import {
  getExpenseDay,
  listExpenseSummaries,
  upsertExpenseDay,
} from "@/lib/query/expenses";

export async function GET(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const url = new URL(request.url);
    const date = url.searchParams.get("date");

    if (date) {
      return Response.json(await getExpenseDay(session.user.id, date));
    }

    return Response.json(await listExpenseSummaries(session.user.id));
  });
}

export async function PUT(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const body = await request.json();

    return Response.json(
      await upsertExpenseDay({
        ...body,
        userId: session.user.id,
      }),
    );
  });
}
