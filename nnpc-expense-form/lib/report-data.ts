import { apiRequest } from "@/lib/api-client";
import {
  formatFileSize,
  hasRowContent,
  type ExpenseRow,
  type ExpenseSummary,
  type ExportLanguage,
  type ReceiptDraft,
} from "@/lib/expense-data";

export type ExpenseDayDocument = {
  reportId: string;
  expenseCode: string;
  companyAddress: string;
  companyId: string;
  companyName: string;
  companyTaxId: string;
  companyLogoBucketName: string;
  companyLogoObjectPath: string;
  companyLogoUrl: string;
  department: string;
  employeeName: string;
  exportLanguage: ExportLanguage;
  note: string;
  rows: ExpenseRow[];
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Receipt preview failed."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Receipt preview failed."));
    };

    reader.readAsDataURL(file);
  });
}

async function materializeReceipts(rows: ExpenseRow[]) {
  let didUpload = false;

  const nextRows = await Promise.all(
    rows.map(async (row) => {
      const receipts = await Promise.all(
        row.receipts.map(async (receipt) => {
          if (!receipt.file) {
            return receipt;
          }

          didUpload = true;
          const dataUrl = await readFileAsDataUrl(receipt.file);

          return {
            ...receipt,
            bucketName: "sql-server",
            file: undefined,
            fileSizeBytes: receipt.file.size,
            mimeType: receipt.file.type || receipt.mimeType || null,
            objectPath: dataUrl,
            previewUrl: dataUrl,
            sizeLabel: formatFileSize(receipt.file.size),
          } satisfies ReceiptDraft;
        }),
      );

      return {
        ...row,
        receipts,
      };
    }),
  );

  return { didUpload, rows: nextRows };
}

export async function listExpenseSummaries(accessToken: string) {
  void accessToken;
  return apiRequest<ExpenseSummary[]>("/api/expenses");
}

export async function getExpenseDay(accessToken: string, expenseDate: string) {
  void accessToken;
  return apiRequest<ExpenseDayDocument | null>(
    `/api/expenses?date=${encodeURIComponent(expenseDate)}`,
  );
}

export async function upsertExpenseDay({
  companyAddress,
  companyId,
  companyLogoBucketName,
  companyLogoObjectPath,
  companyLogoUrl,
  companyName,
  companyTaxId,
  department,
  employeeName,
  expenseDate,
  exportLanguage,
  note,
  rows,
}: {
  accessToken: string;
  companyAddress: string;
  companyId: string;
  companyLogoBucketName: string;
  companyLogoObjectPath: string;
  companyLogoUrl?: string;
  companyName: string;
  companyTaxId: string;
  department: string;
  employeeName: string;
  expenseDate: string;
  exportLanguage: ExportLanguage;
  note: string;
  rows: ExpenseRow[];
}) {
  const materialized = await materializeReceipts(rows);
  const response = await apiRequest<{
    didUpload: boolean;
    expenseCode: string;
    reportId: string;
    rows: ExpenseRow[];
  }>("/api/expenses", {
    body: JSON.stringify({
      companyAddress,
      companyId,
      companyLogoBucketName,
      companyLogoDataUrl: companyLogoUrl ?? "",
      companyLogoObjectPath,
      companyName,
      companyTaxId,
      department,
      employeeName,
      expenseDate,
      exportLanguage,
      note,
      rows: materialized.rows,
    }),
    method: "PUT",
  });

  return {
    ...response,
    didUpload: materialized.didUpload || response.didUpload,
  };
}

export function buildRowsFromLoadedReport(rows: ExpenseRow[]) {
  if (rows.length === 0) {
    return [] as ExpenseRow[];
  }

  return rows.map((row) => ({
    ...row,
    isExpanded: !hasRowContent(row),
    isReceiptPreviewOpen: false,
  }));
}
