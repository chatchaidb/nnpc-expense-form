import "server-only";

import {
  EXPENSE_TYPES,
  formatFileSize,
  hasRowContent,
  type ExpenseRow,
  type ExpenseSummary,
  type ExportLanguage,
  type ReceiptDraft,
} from "@/lib/expense-data";
import { prisma } from "@/lib/prisma";

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

function buildExpenseCode(expenseDate: string) {
  return `EXP-${expenseDate.replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
}

function toDateOnly(expenseDate: string) {
  return new Date(`${expenseDate}T00:00:00.000Z`);
}

function toExpenseDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function expenseTypeLabel(typeId: string) {
  return EXPENSE_TYPES.find((type) => type.id === typeId)?.label ?? "Miscellaneous";
}

function buildReceiptDraft(receipt: {
  bucketName: string;
  fileSizeBytes: bigint | null;
  id: string;
  mimeType: string | null;
  objectPath: string;
  originalFileName: string;
}) {
  return {
    bucketName: receipt.bucketName,
    fileSizeBytes:
      typeof receipt.fileSizeBytes === "bigint" ? Number(receipt.fileSizeBytes) : null,
    id: receipt.id,
    mimeType: receipt.mimeType,
    name: receipt.originalFileName,
    objectPath: receipt.objectPath,
    previewUrl: receipt.objectPath,
    sizeLabel:
      typeof receipt.fileSizeBytes === "bigint"
        ? formatFileSize(Number(receipt.fileSizeBytes))
        : "Saved receipt",
  } satisfies ReceiptDraft;
}

export async function listExpenseSummaries(userId: string) {
  const reports = await prisma.expenseReport.findMany({
    orderBy: { expenseDate: "desc" },
    select: {
      expenseCode: true,
      expenseDate: true,
      totalAmountThb: true,
    },
    where: { userId },
  });

  return reports.map(
    (report) =>
      ({
        date: toExpenseDateInputValue(report.expenseDate),
        expenseCode: report.expenseCode,
        totalAmount: Number(report.totalAmountThb),
      }) satisfies ExpenseSummary,
  );
}

export async function getExpenseDay(userId: string, expenseDate: string) {
  const report = await prisma.expenseReport.findUnique({
    include: {
      items: {
        include: {
          expenseType: true,
          receipts: true,
        },
        orderBy: { lineNumber: "asc" },
      },
    },
    where: {
      userId_expenseDate: {
        expenseDate: toDateOnly(expenseDate),
        userId,
      },
    },
  });

  if (!report) return null;

  return {
    companyAddress: report.companyAddress ?? "",
    companyId: report.companyId ?? "",
    companyLogoBucketName: report.companyLogoBucketName ?? "",
    companyLogoObjectPath: report.companyLogoObjectPath ?? "",
    companyLogoUrl: report.companyLogoDataUrl ?? "",
    companyName: report.companyName ?? "",
    companyTaxId: report.companyTaxId ?? "",
    department: report.department ?? "",
    employeeName: report.employeeName ?? "",
    expenseCode: report.expenseCode,
    exportLanguage: report.exportLanguage === "th" ? "th" : "en",
    note: report.note ?? "",
    reportId: report.id,
    rows: report.items.map((item, index) => ({
      amount: String(item.amountThb),
      id: index + 1,
      isExpanded: false,
      isReceiptPreviewOpen: false,
      receipts: item.receipts.map(buildReceiptDraft),
      remark: item.remark ?? "",
      typeId:
        EXPENSE_TYPES.find((type) => type.label === item.expenseTypeLabel)?.id ??
        item.expenseType?.code ??
        "misc",
    })),
  } satisfies ExpenseDayDocument;
}

export async function upsertExpenseDay({
  companyAddress,
  companyId,
  companyLogoDataUrl,
  companyLogoBucketName,
  companyLogoObjectPath,
  companyName,
  companyTaxId,
  department,
  employeeName,
  expenseDate,
  exportLanguage,
  note,
  rows,
  userId,
}: {
  companyAddress: string;
  companyId: string;
  companyLogoDataUrl: string;
  companyLogoBucketName: string;
  companyLogoObjectPath: string;
  companyName: string;
  companyTaxId: string;
  department: string;
  employeeName: string;
  expenseDate: string;
  exportLanguage: ExportLanguage;
  note: string;
  rows: ExpenseRow[];
  userId: string;
}) {
  const persistedRows = rows.filter(hasRowContent);
  const totalAmount = persistedRows.reduce(
    (total, row) => total + Number(row.amount || 0),
    0,
  );
  const expenseDateValue = toDateOnly(expenseDate);
  const existingReport = await prisma.expenseReport.findUnique({
    where: { userId_expenseDate: { expenseDate: expenseDateValue, userId } },
  });
  const report = await prisma.expenseReport.upsert({
    create: {
      companyAddress: companyAddress.trim() || null,
      companyId: companyId || null,
      companyLogoBucketName: companyLogoBucketName || null,
      companyLogoDataUrl: companyLogoDataUrl || null,
      companyLogoObjectPath: companyLogoObjectPath || null,
      companyName: companyName.trim() || null,
      companyTaxId: companyTaxId.trim() || null,
      department: department.trim() || null,
      employeeName: employeeName.trim() || null,
      expenseCode: buildExpenseCode(expenseDate),
      expenseDate: expenseDateValue,
      exportLanguage,
      note: note.trim() || null,
      totalAmountThb: totalAmount,
      userId,
    },
    update: {
      companyAddress: companyAddress.trim() || null,
      companyId: companyId || null,
      companyLogoBucketName: companyLogoBucketName || null,
      companyLogoDataUrl: companyLogoDataUrl || null,
      companyLogoObjectPath: companyLogoObjectPath || null,
      companyName: companyName.trim() || null,
      companyTaxId: companyTaxId.trim() || null,
      department: department.trim() || null,
      employeeName: employeeName.trim() || null,
      exportLanguage,
      note: note.trim() || null,
      totalAmountThb: totalAmount,
    },
    where: { userId_expenseDate: { expenseDate: expenseDateValue, userId } },
  });

  if (existingReport) {
    await prisma.expenseItem.deleteMany({ where: { reportId: report.id } });
  }

  for (const [index, row] of persistedRows.entries()) {
    const type = await prisma.expenseType.findUnique({ where: { code: row.typeId } });

    await prisma.expenseItem.create({
      data: {
        amountThb: Number(row.amount || 0),
        expenseTypeId: type?.id ?? null,
        expenseTypeLabel: type?.label ?? expenseTypeLabel(row.typeId),
        lineNumber: index + 1,
        remark: row.remark.trim() || null,
        reportId: report.id,
        receipts: {
          create: row.receipts.map((receipt) => ({
            bucketName: receipt.bucketName ?? "sql-server",
            fileSizeBytes: receipt.fileSizeBytes ? BigInt(receipt.fileSizeBytes) : null,
            mimeType: receipt.mimeType ?? null,
            objectPath: receipt.objectPath || receipt.previewUrl,
            originalFileName: receipt.name,
          })),
        },
      },
    });
  }

  return {
    didUpload: false,
    expenseCode: report.expenseCode,
    reportId: report.id,
    rows,
  };
}

export function buildRowsFromLoadedReport(rows: ExpenseRow[]) {
  if (rows.length === 0) return [] as ExpenseRow[];
  return rows.map((row) => ({
    ...row,
    isExpanded: !hasRowContent(row),
    isReceiptPreviewOpen: false,
  }));
}
