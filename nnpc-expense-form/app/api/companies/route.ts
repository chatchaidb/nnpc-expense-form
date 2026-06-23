import { requireRoles, requireSession, withApiErrors } from "@/lib/api-session";
import {
  createUserCompany,
  deleteUserCompany,
  listUserCompanies,
  updateUserCompany,
} from "@/lib/query/companies";

async function readImageFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  if (!value.type.startsWith("image/")) {
    throw new Error("Company logo must be an image file.");
  }

  return {
    buffer: Buffer.from(await value.arrayBuffer()),
    mimeType: value.type || "application/octet-stream",
    name: value.name || "logo",
  };
}

export async function GET() {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    return Response.json(await listUserCompanies(session.user.id));
  });
}

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireRoles(["admin", "central_admin"]);
    const formData = await request.formData();
    const logoFile = await readImageFile(formData, "logoFile");

    if (!logoFile) {
      return Response.json({ message: "Company logo is required." }, { status: 400 });
    }

    return Response.json(
      await createUserCompany({
        companyAddress: String(formData.get("companyAddress") ?? ""),
        companyName: String(formData.get("companyName") ?? ""),
        companyTaxId: String(formData.get("companyTaxId") ?? ""),
        logoFile,
        originalLogoFileName: logoFile.name,
        userId: session.user.id,
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return withApiErrors(async () => {
    await requireRoles(["admin", "central_admin"]);
    const formData = await request.formData();
    const companyId = String(formData.get("companyId") ?? "");
    const logoFile = await readImageFile(formData, "logoFile");

    if (!companyId) {
      return Response.json({ message: "Company id is required." }, { status: 400 });
    }

    return Response.json(
      await updateUserCompany({
        companyAddress: String(formData.get("companyAddress") ?? ""),
        companyId,
        companyName: String(formData.get("companyName") ?? ""),
        companyTaxId: String(formData.get("companyTaxId") ?? ""),
        logoFile: logoFile ?? undefined,
        originalLogoFileName: logoFile?.name,
      }),
    );
  });
}

export async function DELETE(request: Request) {
  return withApiErrors(async () => {
    await requireRoles(["admin", "central_admin"]);
    const url = new URL(request.url);
    const companyId = url.searchParams.get("companyId") ?? "";

    if (!companyId) {
      return Response.json({ message: "Company id is required." }, { status: 400 });
    }

    return Response.json(await deleteUserCompany(companyId));
  });
}
