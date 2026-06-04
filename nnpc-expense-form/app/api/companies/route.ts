import { requireSession, withApiErrors } from "@/lib/api-session";
import {
  createUserCompany,
  listUserCompanies,
  updateUserCompany,
} from "@/lib/query/companies";

export async function GET() {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    return Response.json(await listUserCompanies(session.user.id));
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const body = (await request.json()) as {
      companyAddress?: string;
      companyName?: string;
      companyTaxId?: string;
      logoDataUrl?: string;
      originalLogoFileName?: string;
    };

    return Response.json(
      await createUserCompany({
        companyAddress: body.companyAddress ?? "",
        companyName: body.companyName ?? "",
        companyTaxId: body.companyTaxId ?? "",
        logoDataUrl: body.logoDataUrl ?? "",
        originalLogoFileName: body.originalLogoFileName ?? "logo",
        userId: session.user.id,
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const body = (await request.json()) as {
      companyAddress?: string;
      companyId?: string;
      companyName?: string;
      companyTaxId?: string;
      logoDataUrl?: string;
      originalLogoFileName?: string;
    };

    if (!body.companyId) {
      return Response.json({ message: "Company id is required." }, { status: 400 });
    }

    return Response.json(
      await updateUserCompany({
        companyAddress: body.companyAddress ?? "",
        companyId: body.companyId,
        companyName: body.companyName ?? "",
        companyTaxId: body.companyTaxId ?? "",
        logoDataUrl: body.logoDataUrl,
        originalLogoFileName: body.originalLogoFileName,
        userId: session.user.id,
      }),
    );
  });
}
