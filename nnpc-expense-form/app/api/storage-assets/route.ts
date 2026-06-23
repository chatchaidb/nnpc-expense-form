import { requireSession, withApiErrors } from "@/lib/api-session";
import { fetchR2Object } from "@/lib/r2-storage";

function isAllowedAssetPath(objectPath: string, userId: string) {
  return (
    objectPath.startsWith("company-assets/") ||
    objectPath.startsWith(`expense-receipts/${userId}/`)
  );
}

export async function GET(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const url = new URL(request.url);
    const objectPath = url.searchParams.get("path")?.trim() ?? "";

    if (!objectPath) {
      return Response.json({ message: "Object path is required." }, { status: 400 });
    }

    if (!isAllowedAssetPath(objectPath, session.user.id)) {
      return Response.json({ message: "Forbidden" }, { status: 403 });
    }

    const object = await fetchR2Object(objectPath);
    const headers = new Headers({
      "Cache-Control": "private, max-age=300",
      "Content-Type": object.contentType,
    });

    if (object.contentLength) {
      headers.set("Content-Length", object.contentLength);
    }

    return new Response(object.body, { headers });
  });
}
