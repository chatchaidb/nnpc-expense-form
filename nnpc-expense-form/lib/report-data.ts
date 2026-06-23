import { apiRequest } from "@/lib/api-client";
import {
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

async function uploadReceipt({
  expenseDate,
  file,
  rowId,
}: {
  expenseDate: string;
  file: File;
  rowId: number;
}) {
  const formData = new FormData();
  formData.set("expenseDate", expenseDate);
  formData.set("receiptFile", file);
  formData.set("rowId", String(rowId));

  return apiRequest<ReceiptDraft>("/api/receipts", {
    body: formData,
    method: "POST",
  });
}

async function materializeReceipts(rows: ExpenseRow[], expenseDate: string) {
  let didUpload = false;

  const nextRows = await Promise.all(
    rows.map(async (row) => {
      const receipts = await Promise.all(
        row.receipts.map(async (receipt) => {
          if (!receipt.file) {
            return receipt;
          }

          didUpload = true;
          const uploadedReceipt = await uploadReceipt({
            expenseDate,
            file: receipt.file,
            rowId: row.id,
          });

          return {
            ...receipt,
            ...uploadedReceipt,
            file: undefined,
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
  const materialized = await materializeReceipts(rows, expenseDate);
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
