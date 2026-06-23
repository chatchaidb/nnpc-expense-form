import { requireSession, withApiErrors } from "@/lib/api-session";
import { formatFileSize } from "@/lib/expense-data";
import { compressReceiptImage } from "@/lib/receipt-image";
import {
  createReceiptObjectPath,
  getPublicObjectUrl,
  getR2BucketName,
  uploadR2Object,
} from "@/lib/r2-storage";

export async function POST(request: Request) {
  return withApiErrors(async () => {
    const { session } = await requireSession();
    const formData = await request.formData();
    const receiptFile = formData.get("receiptFile");
    const expenseDate = String(formData.get("expenseDate") ?? "");
    const rowId = String(formData.get("rowId") ?? "");

    if (!(receiptFile instanceof File) || receiptFile.size === 0) {
      return Response.json({ message: "Receipt image is required." }, { status: 400 });
    }

    if (!receiptFile.type.startsWith("image/")) {
      return Response.json({ message: "Receipt must be an image file." }, { status: 400 });
    }

    if (!expenseDate || !rowId) {
      return Response.json({ message: "Expense date and row id are required." }, { status: 400 });
    }

    const compressedReceipt = await compressReceiptImage(
      Buffer.from(await receiptFile.arrayBuffer()),
    );
    const objectPath = createReceiptObjectPath({
      expenseDate,
      fileName: receiptFile.name.replace(/\.[^.]+$/, ".jpg"),
      rowId,
      userId: session.user.id,
    });

    await uploadR2Object({
      body: compressedReceipt.buffer,
      bucketName: getR2BucketName(),
      contentType: compressedReceipt.mimeType,
      objectPath,
    });

    return Response.json({
      bucketName: getR2BucketName(),
      fileSizeBytes: compressedReceipt.size,
      id: crypto.randomUUID(),
      mimeType: compressedReceipt.mimeType,
      name: receiptFile.name,
      objectPath,
      previewUrl: getPublicObjectUrl(objectPath),
      sizeLabel: formatFileSize(compressedReceipt.size),
    });
  });
}
