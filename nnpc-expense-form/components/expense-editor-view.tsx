"use client";

import Image from "next/image";
import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  CircleAlert,
  Building2,
  ChevronDown,
  ChevronUp,
  CloudCheck,
  CloudUpload,
  Download,
  ImagePlus,
  LoaderCircle,
  Plus,
  Printer,
  Receipt,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ThemeSettingsSheet } from "@/components/theme-settings-sheet";
import {
  MobileExpenseBottomDock,
  MobileExpenseWorkflowSummary,
} from "@/components/mobile/expense-editor/mobile-expense-workflow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  clearExpenseDraftCache,
  readExpenseDraftCache,
  readCompaniesCache,
  readExpenseDayCache,
  type ExpenseDraftSnapshot,
  upsertExpenseSummaryCache,
  writeExpenseDraftCache,
  writeCompaniesCache,
  writeExpenseDayCache,
} from "@/lib/browser-cache";
import AuthGate, { type AuthSession } from "./auth-gate";
import {
  SESSION_EXPIRED_MESSAGE,
  listUserCompanies,
  type CompanyRecord,
} from "../lib/company-data";
import {
  formatDisplayDate,
  formatExpenseLineReferenceCode,
  formatExpenseReferenceCode,
} from "../lib/date";
import {
  EXPENSE_TYPES,
  createEmptyRow,
  deriveDisplayName,
  findExpenseTypeLabel,
  formatCurrency,
  formatFileSize,
  hasRowContent,
  parseAmount,
  type ExpenseRow,
  type ExportLanguage,
  type ReceiptDraft,
} from "../lib/expense-data";
import {
  buildRowsFromLoadedReport,
  type ExpenseDayDocument,
  getExpenseDay,
  upsertExpenseDay,
} from "../lib/report-data";
import { getUserProfile, type UserProfile } from "../lib/profile-data";

const EMPTY_COMPANY_VALUE = "__none__";
const EXPORT_FORM_ROWS_PER_PAGE = 5;
const RECEIPTS_PER_PAGE = 4;
const IMAGE_PRELOAD_TIMEOUT_MS = 12_000;
const PRINT_TABLE_GRID_TEMPLATE = "1.6fr 1.75fr 2.95fr 1.25fr";
const EXPORT_PAGE_WIDTH_PX = 794;
const EXPORT_PAGE_HEIGHT_PX = 1123;
const BLANK_PRINT_FIELD_VALUE = " ";
const EMPLOYEE_NAME_MAX_LENGTH = 64;
const DEPARTMENT_MAX_LENGTH = 48;
const EXPORT_NOTE_MAX_LENGTH = 240;
const EXPENSE_REMARK_MAX_LENGTH = 220;
const COMPANY_NAME_MAX_LENGTH = 96;
const COMPANY_TAX_ID_MAX_LENGTH = 32;
const COMPANY_ADDRESS_MAX_LENGTH = 240;

const EXPORT_COPY: Record<
  ExportLanguage,
  {
    formTitle: string;
    formSubtitle: string;
    companyCaption: string;
    companyPending: string;
    companyTaxId: string;
    department: string;
    date: string;
    employee: string;
    reference: string;
    note: string;
    line: string;
    expenseType: string;
    expenseNote: string;
    amount: string;
    total: string;
    noExpenses: string;
    emptyRemark: string;
    noteFallback: string;
    receiptLabel: string;
    expenseLabel: string;
    receiptsSheetTitle: string;
    signatures: [string, string, string];
    signatureHint: string;
  }
> = {
  en: {
    formTitle: "Expense reimbursement form",
    formSubtitle: "",
    companyCaption: "Company",
    companyPending: "Select a company in Company details",
    companyTaxId: "Company Tax ID",
    department: "Department",
    date: "Date",
    employee: "Employee",
    reference: "Expense Serial No.",
    note: "Note",
    line: "No.",
    expenseType: "Expense type",
    expenseNote: "Expense note",
    amount: "Amount",
    total: "Total amount",
    noExpenses: "No expenses added for this day.",
    emptyRemark: "No extra remark",
    noteFallback: "No additional note.",
    receiptLabel: "Receipt Image",
    expenseLabel: "Expense",
    receiptsSheetTitle: "Receipt attachments",
    signatures: ["Requester", "Cash recipient", "Approver"],
    signatureHint: "Sign here",
  },
  th: {
    formTitle: "ใบเบิกค่าใช้จ่าย",
    formSubtitle: "",
    companyCaption: "บริษัท",
    companyPending: "กรุณาเลือกบริษัทจากแท็บข้อมูลบริษัท",
    companyTaxId: "เลขประจำตัวผู้เสียภาษี",
    department: "แผนก",
    date: "วันที่",
    employee: "ชื่อผู้เบิก",
    reference: "เลขที่เอกสารฝ่ายการเงิน",
    note: "หมายเหตุ",
    line: "ลำดับ",
    expenseType: "ประเภทค่าใช้จ่าย",
    expenseNote: "รายละเอียด",
    amount: "จำนวนเงิน",
    total: "รวมจำนวนเงิน",
    noExpenses: "ยังไม่มีรายการค่าใช้จ่ายสำหรับวันนี้",
    emptyRemark: "ไม่มีรายละเอียดเพิ่มเติม",
    noteFallback: "ไม่มีหมายเหตุเพิ่มเติม",
    receiptLabel: "รูปใบเสร็จ",
    expenseLabel: "รายการ",
    receiptsSheetTitle: "รูปใบเสร็จแนบ",
    signatures: ["ผู้เสนอเบิก", "พนักงานผู้รับเงิน", "ผู้อนุมัติ"],
    signatureHint: "ลงชื่อ",
  },
};

const THAI_EXPENSE_TYPE_LABELS: Record<string, string> = {
  transportation: "ค่าใช้จ่ายในการเดินทาง",
  client_food: "ค่าอาหารลูกค้า",
  gas: "ค่าน้ำมัน",
  toll_fee: "ค่าทางด่วน",
  misc: "ค่าใช้จ่ายอื่น ๆ",
};

type PendingRemoval =
  | {
      kind: "receipt";
      receiptId: string;
      receiptName: string;
      rowId: number;
      rowReference: string;
    }
  | {
      kind: "row";
      rowId: number;
      rowReference: string;
    };

type PrintableFormRow = {
  lineNumber: number;
  row: ExpenseRow;
};

type PrintableReceiptEntry = {
  key: string;
  label: string;
  lineNumber: number;
  receipt: ReceiptDraft;
  row: ExpenseRow;
};

type ExportCopy = (typeof EXPORT_COPY)[ExportLanguage];

type ExportFileHandle = {
  createWritable: () => Promise<{
    close: () => Promise<void>;
    write: (data: Blob) => Promise<void>;
  }>;
};

type ExportDeliveryTarget =
  | {
      file: File;
      kind: "share";
    }
  | {
      fileName: string;
      kind: "file-picker";
    }
  | {
      fileName: string;
      kind: "open";
    }
  | {
      fileName: string;
      kind: "download";
    };

type ExportDeliveryResult =
  | {
      kind: "cancelled";
      message: null;
    }
  | {
      kind: "downloaded" | "opened" | "saved" | "shared";
      message: string;
    };

type ExportAssetPreparationResult = {
  assetUrlMap: Record<string, string>;
  objectUrls: string[];
};

type ExportPdfSource = {
  assetUrlMap: Record<string, string>;
  companyAddress: string;
  companyTaxId: string;
  department: string;
  displayExpenseReference: string;
  employeeName: string;
  expenseDate: string;
  exportCopy: ExportCopy;
  exportLanguage: ExportLanguage;
  note: string;
  printableFormPages: PrintableFormRow[][];
  receiptPages: PrintableReceiptEntry[][];
  selectedCompanyLogoUrl: string;
  selectedCompanyName: string;
  totalAmount: number;
};

type PendingSaveSnapshot = {
  companyAddress: string;
  companyId: string;
  companyLogoBucketName: string;
  companyLogoObjectPath: string;
  companyName: string;
  companyTaxId: string;
  department: string;
  employeeName: string;
  exportLanguage: ExportLanguage;
  note: string;
  rows: ExpenseRow[];
};

type HydratedExpenseDraft = {
  companyId: string;
  department: string;
  employeeName: string;
  exportLanguage: ExportLanguage;
  note: string;
  rows: ExpenseRow[];
};

export default function ExpenseEditorView({
  expenseDate,
}: {
  expenseDate: string;
}) {
  return (
    <AuthGate>
      {({ session, logout }) => (
        <ProtectedExpenseEditor
          expenseDate={expenseDate}
          logout={logout}
          session={session}
        />
      )}
    </AuthGate>
  );
}

async function toReceiptDrafts(rowId: number, files: FileList | null) {
  const fileEntries = Array.from(files ?? []);

  return Promise.all(
    fileEntries.map(async (file, index) => ({
      id:
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${rowId}-${Date.now()}-${index}-${file.name}`,
      file,
      fileSizeBytes: file.size,
      mimeType: file.type || null,
      name: file.name,
      previewUrl: await readFileAsDataUrl(file),
      sizeLabel: formatFileSize(file.size),
    })),
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("This photo could not be prepared."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("This photo could not be prepared."));
    };

    reader.readAsDataURL(file);
  });
}

function resizeTextareaElement(element: HTMLTextAreaElement | null) {
  if (!element) {
    return;
  }

  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
}

function limitTextLength(value: string, maxLength: number) {
  return value.slice(0, maxLength);
}

function limitExpenseRowsForExport(rows: ExpenseRow[]) {
  return rows.map((row) => ({
    ...row,
    remark: limitTextLength(row.remark, EXPENSE_REMARK_MAX_LENGTH),
  }));
}

function isDataUrl(url: string) {
  return url.startsWith("data:");
}

function dataUrlToFile(dataUrl: string, fileName: string, mimeType?: string | null) {
  const [header, encodedContent] = dataUrl.split(",", 2);

  if (!header || !encodedContent) {
    throw new Error("Draft receipt data URL was malformed.");
  }

  const resolvedMimeType =
    mimeType ?? /data:([^;]+)/.exec(header)?.[1] ?? "application/octet-stream";
  const binaryString = window.atob(encodedContent);
  const bytes = Uint8Array.from(binaryString, (character) => character.charCodeAt(0));

  return new File([bytes], fileName, { type: resolvedMimeType });
}

function hydrateDraftRows(rows: ExpenseDraftSnapshot["rows"]) {
  return rows.map(
    (row) =>
      ({
        ...row,
        receipts: row.receipts.map((receipt) => ({
          ...receipt,
          file:
            !receipt.objectPath && isDataUrl(receipt.previewUrl)
              ? dataUrlToFile(receipt.previewUrl, receipt.name, receipt.mimeType)
              : undefined,
        })),
      }) satisfies ExpenseRow,
  );
}

function serializeRowsForDraft(rows: ExpenseRow[]): ExpenseDraftSnapshot["rows"] {
  return rows.map((row) => ({
    amount: row.amount,
    id: row.id,
    isExpanded: row.isExpanded,
    isReceiptPreviewOpen: row.isReceiptPreviewOpen,
    receipts: row.receipts.map((receipt) => ({
      bucketName: receipt.bucketName,
      fileSizeBytes: receipt.fileSizeBytes ?? null,
      id: receipt.id,
      mimeType: receipt.mimeType ?? null,
      name: receipt.name,
      objectPath: receipt.objectPath,
      previewUrl: receipt.previewUrl,
      sizeLabel: receipt.sizeLabel,
    })),
    remark: row.remark,
    typeId: row.typeId,
  }));
}

function getFriendlyEditorError(
  error: unknown,
  action: "load" | "save" | "receipt" | "print",
) {
  const message = error instanceof Error ? error.message : "";

  if (/session expired/i.test(message)) {
    return "Your session ended. Please sign in again.";
  }

  if (/Missing database URL|database/i.test(message)) {
    return "This page is not fully set up yet. Please ask the app owner to finish the setup.";
  }

  if (/Failed to fetch|NetworkError|network request|Load failed|fetch/i.test(message)) {
    if (action === "load") {
      return "We couldn't open this expense page right now. Please check your internet connection and try again.";
    }

    if (action === "print") {
      return "We couldn't prepare the receipt photos for PDF export. Please try again in a moment.";
    }

    return "We couldn't save your latest changes right now. Please check your internet connection and try again.";
  }

  if (/permission|forbidden|unauthorized|row-level security/i.test(message)) {
    return "You don't have access to do that right now. Please sign in again and try once more.";
  }

  if (action === "receipt") {
    return "One of the receipt photos could not be added. Please try a different image.";
  }

  if (action === "load") {
    return "We couldn't open this expense page right now. Please try again.";
  }

  if (action === "print") {
    return "We couldn't create the PDF export. Please try again.";
  }

  return "We couldn't save your latest changes. Please try again.";
}

function preloadImageUrl(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new window.Image();
    const timeoutId = window.setTimeout(() => resolve(false), IMAGE_PRELOAD_TIMEOUT_MS);

    const finish = (didLoad: boolean) => {
      window.clearTimeout(timeoutId);
      resolve(didLoad);
    };

    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.decoding = "async";
    image.src = url;

    if (image.complete) {
      finish(image.naturalWidth > 0);
    }
  });
}

async function preloadPrintableAssets(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  if (uniqueUrls.length === 0) {
    return true;
  }

  const results = await Promise.all(uniqueUrls.map((url) => preloadImageUrl(url)));

  return results.every(Boolean);
}

function isInlineAssetUrl(url: string) {
  return url.startsWith("blob:") || url.startsWith("data:");
}

async function buildExportAssetUrlMap(urls: string[]): Promise<ExportAssetPreparationResult> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  if (uniqueUrls.length === 0) {
    return {
      assetUrlMap: {},
      objectUrls: [],
    };
  }

  const objectUrls: string[] = [];
  const mappedEntries = await Promise.all(
    uniqueUrls.map(async (url) => {
      if (isInlineAssetUrl(url)) {
        return [url, url] as const;
      }

      const response = await fetch(url, {
        cache: "force-cache",
        mode: "cors",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch export asset (${response.status} ${response.statusText}) for ${url}.`,
        );
      }

      const assetBlob = await response.blob();
      const objectUrl = URL.createObjectURL(assetBlob);
      objectUrls.push(objectUrl);

      return [url, objectUrl] as const;
    }),
  );

  return {
    assetUrlMap: Object.fromEntries(mappedEntries),
    objectUrls,
  };
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function buildExportFileName(reference: string, expenseDate: string) {
  const safeReference = reference
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  return `${safeReference || `expense-${expenseDate}`}.pdf`;
}

const EXPORT_RENDER_SCALE = 2;
const EXPORT_PAGE_PADDING_PX = 45;
const EXPORT_CONTENT_WIDTH_PX = EXPORT_PAGE_WIDTH_PX - EXPORT_PAGE_PADDING_PX * 2;
const EXPORT_TABLE_COLUMN_WIDTHS_PX = [1.6, 1.75, 2.95, 1.25].map(
  (fraction) => (EXPORT_CONTENT_WIDTH_PX * fraction) / 7.55,
);

function createExportPageCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_PAGE_WIDTH_PX * EXPORT_RENDER_SCALE;
  canvas.height = EXPORT_PAGE_HEIGHT_PX * EXPORT_RENDER_SCALE;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("A canvas context was not available for PDF export.");
  }

  context.scale(EXPORT_RENDER_SCALE, EXPORT_RENDER_SCALE);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, EXPORT_PAGE_WIDTH_PX, EXPORT_PAGE_HEIGHT_PX);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.textBaseline = "top";

  return { canvas, context };
}

function truncateTextToWidth(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  let nextText = text.trimEnd();

  while (nextText && context.measureText(`${nextText}\u2026`).width > maxWidth) {
    nextText = nextText.slice(0, -1);
  }

  return nextText ? `${nextText}\u2026` : "\u2026";
}

function splitTextIntoLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return [] as string[];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const character of Array.from(normalizedText)) {
    const candidate = `${currentLine}${character}`;

    if (context.measureText(candidate).width <= maxWidth || currentLine.length === 0) {
      currentLine = candidate;
      continue;
    }

    lines.push(currentLine.trim());
    currentLine = character;

    if (lines.length === maxLines) {
      break;
    }
  }

  if (lines.length < maxLines && currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  const joinedLines = lines.join("");

  if (joinedLines.length < normalizedText.length && lines.length > 0) {
    lines[lines.length - 1] = truncateTextToWidth(
      context,
      lines[lines.length - 1] ?? "",
      maxWidth,
    );
  }

  return lines.slice(0, maxLines);
}

function drawTextBlock({
  align = "left",
  color = "#000000",
  context,
  font,
  lineHeight,
  maxLines,
  maxWidth,
  text,
  x,
  y,
}: {
  align?: CanvasTextAlign;
  color?: string;
  context: CanvasRenderingContext2D;
  font: string;
  lineHeight: number;
  maxLines: number;
  maxWidth: number;
  text: string;
  x: number;
  y: number;
}) {
  context.save();
  context.fillStyle = color;
  context.font = font;

  const lines = splitTextIntoLines(context, text, maxWidth, maxLines);

  lines.forEach((line, index) => {
    const drawX =
      align === "right" ? x + maxWidth - context.measureText(line).width : x;

    context.fillText(line, drawX, y + index * lineHeight);
  });

  context.restore();

  return lines.length * lineHeight;
}

function measureTextBlockHeight({
  context,
  font,
  lineHeight,
  maxLines = Number.MAX_SAFE_INTEGER,
  maxWidth,
  text,
}: {
  context: CanvasRenderingContext2D;
  font: string;
  lineHeight: number;
  maxLines?: number;
  maxWidth: number;
  text: string;
}) {
  context.save();
  context.font = font;
  const height = splitTextIntoLines(context, text, maxWidth, maxLines).length * lineHeight;
  context.restore();

  return height;
}

function getCompanyNameTextStyle(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const options = [
    { font: "600 26px Georgia, 'Times New Roman', serif", lineHeight: 27, maxLines: 2 },
    { font: "600 23px Georgia, 'Times New Roman', serif", lineHeight: 25, maxLines: 3 },
    { font: "600 20px Georgia, 'Times New Roman', serif", lineHeight: 23, maxLines: 3 },
    { font: "600 18px Georgia, 'Times New Roman', serif", lineHeight: 21, maxLines: 4 },
  ];

  context.save();

  for (const option of options) {
    context.font = option.font;
    const lines = splitTextIntoLines(context, text, maxWidth, option.maxLines);
    const didFit = lines.length > 0 && !lines.some((line) => line.endsWith("\u2026"));

    if (didFit) {
      context.restore();
      return option;
    }
  }

  context.restore();
  return options[options.length - 1];
}

function drawHorizontalRule(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color: string,
) {
  context.save();
  context.beginPath();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.stroke();
  context.restore();
}

function getCompanyAddressHeaderWidth(address: string) {
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return 0;
  }

  if (trimmedAddress.length > 110) {
    return 224;
  }

  if (trimmedAddress.length > 64) {
    return 196;
  }

  return 164;
}

function shouldStackCompanyAddressHeader(companyName: string, address: string) {
  const trimmedCompanyName = companyName.trim();
  const trimmedAddress = address.trim();

  if (!trimmedAddress) {
    return false;
  }

  const addressLineCount = trimmedAddress.split(/\r?\n/).filter(Boolean).length;

  return (
    trimmedAddress.length > 96 ||
    addressLineCount > 2 ||
    (trimmedCompanyName.length > 42 && trimmedAddress.length > 54)
  );
}

function drawImageContain({
  context,
  height,
  image,
  width,
  x,
  y,
}: {
  context: CanvasRenderingContext2D;
  height: number;
  image: HTMLImageElement;
  width: number;
  x: number;
  y: number;
}) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const targetWidth = image.naturalWidth * scale;
  const targetHeight = image.naturalHeight * scale;
  const drawX = x + (width - targetWidth) / 2;
  const drawY = y + (height - targetHeight) / 2;

  context.drawImage(image, drawX, drawY, targetWidth, targetHeight);
}

function loadCanvasImage(
  url: string,
  cache: Map<string, Promise<HTMLImageElement | null>>,
) {
  const cachedImage = cache.get(url);

  if (cachedImage) {
    return cachedImage;
  }

  const nextImage = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new window.Image();
    image.decoding = "sync";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });

  cache.set(url, nextImage);
  return nextImage;
}

function drawInfoLine({
  context,
  label,
  reserveWritingSpace,
  value,
  width,
  x,
  y,
}: {
  context: CanvasRenderingContext2D;
  label: string;
  reserveWritingSpace?: boolean;
  value: string;
  width: number;
  x: number;
  y: number;
}) {
  drawTextBlock({
    color: "rgba(0,0,0,0.45)",
    context,
    font: "600 11px Arial, sans-serif",
    lineHeight: 12,
    maxLines: 1,
    maxWidth: width,
    text: label.toUpperCase(),
    x,
    y,
  });

  if (!reserveWritingSpace || value.trim()) {
    drawTextBlock({
      context,
      font: "500 13px Arial, sans-serif",
      lineHeight: 20,
      maxLines: 2,
      maxWidth: width,
      text: value,
      x,
      y: y + 18,
    });
  }

  const ruleY = y + (reserveWritingSpace ? 62 : 52);
  drawHorizontalRule(context, x, ruleY, width, "rgba(0,0,0,0.15)");

  return ruleY;
}

async function renderFormPageCanvas(
  source: ExportPdfSource,
  rows: PrintableFormRow[],
  pageIndex: number,
  imageCache: Map<string, Promise<HTMLImageElement | null>>,
) {
  const { canvas, context } = createExportPageCanvas();
  const contentX = EXPORT_PAGE_PADDING_PX;
  const contentWidth = EXPORT_CONTENT_WIDTH_PX;
  const logoSize = 64;
  const headerTextX = contentX + logoSize + 18;
  const trimmedCompanyAddress = source.companyAddress.trim();
  const companyNameText = source.selectedCompanyName || source.exportCopy.companyPending;
  const hasCompanyAddress = Boolean(trimmedCompanyAddress);
  const shouldStackAddressHeader = shouldStackCompanyAddressHeader(
    companyNameText,
    trimmedCompanyAddress,
  );
  const rightHeaderWidth =
    hasCompanyAddress && !shouldStackAddressHeader
      ? getCompanyAddressHeaderWidth(trimmedCompanyAddress)
      : 0;
  const headerSideReserve = rightHeaderWidth
    ? rightHeaderWidth + 24
    : source.printableFormPages.length > 1
      ? 156
      : 0;
  const headerTextMaxWidth = Math.max(
    220,
    contentX + contentWidth - headerTextX - headerSideReserve,
  );
  const infoGap = 20;
  const leftInfoWidth = (contentWidth - infoGap) * 0.4;
  const rightInfoWidth = contentWidth - infoGap - leftInfoWidth;
  const rightInfoX = contentX + leftInfoWidth + infoGap;
  let y = EXPORT_PAGE_PADDING_PX;

  if (source.selectedCompanyLogoUrl) {
    const logoImage = await loadCanvasImage(source.selectedCompanyLogoUrl, imageCache);

    if (logoImage) {
      drawImageContain({
        context,
        height: logoSize,
        image: logoImage,
        width: logoSize,
        x: contentX,
        y,
      });
    } else {
      drawTextBlock({
        align: "left",
        color: "rgba(0,0,0,0.45)",
        context,
        font: "600 11px Arial, sans-serif",
        lineHeight: 12,
        maxLines: 2,
        maxWidth: logoSize,
        text: "Logo",
        x: contentX + 8,
        y: y + 24,
      });
    }
  }

  drawTextBlock({
    color: "rgba(0,0,0,0.55)",
    context,
    font: "600 10px Arial, sans-serif",
    lineHeight: 11,
    maxLines: 1,
    maxWidth: headerTextMaxWidth,
    text: source.exportCopy.companyCaption.toUpperCase(),
    x: headerTextX,
    y,
  });

  const companyNameTextStyle = getCompanyNameTextStyle(
    context,
    companyNameText,
    headerTextMaxWidth,
  );
  const companyNameHeight = drawTextBlock({
    context,
    font: companyNameTextStyle.font,
    lineHeight: companyNameTextStyle.lineHeight,
    maxLines: companyNameTextStyle.maxLines,
    maxWidth: headerTextMaxWidth,
    text: companyNameText,
    x: headerTextX,
    y: y + 16,
  });

  let nextHeaderTextY = y + 16 + companyNameHeight + 5;
  const companyTaxIdHeight = source.companyTaxId
    ? drawTextBlock({
        color: "rgba(0,0,0,0.6)",
        context,
        font: "700 10px Arial, sans-serif",
        lineHeight: 13,
        maxLines: 2,
        maxWidth: headerTextMaxWidth,
        text: `${source.exportCopy.companyTaxId.toUpperCase()}: ${source.companyTaxId}`,
        x: headerTextX,
        y: nextHeaderTextY,
      })
    : 0;

  if (companyTaxIdHeight) {
    nextHeaderTextY += companyTaxIdHeight + 5;
  }

  const hasFormSubtitle = Boolean(source.exportCopy.formSubtitle.trim());

  if (hasFormSubtitle) {
    const subtitleHeight = drawTextBlock({
      color: "rgba(0,0,0,0.65)",
      context,
      font: "400 11px Arial, sans-serif",
      lineHeight: 13,
      maxLines: 1,
      maxWidth: headerTextMaxWidth,
      text: source.exportCopy.formSubtitle,
      x: headerTextX,
      y: nextHeaderTextY,
    });

    nextHeaderTextY += subtitleHeight + 7;
  }

  const titleY = nextHeaderTextY;
  drawTextBlock({
    context,
    font: "700 13px Arial, sans-serif",
    lineHeight: 14,
    maxLines: 1,
    maxWidth: headerTextMaxWidth,
    text: source.exportCopy.formTitle,
    x: headerTextX,
    y: titleY,
  });

  if (source.printableFormPages.length > 1) {
    drawTextBlock({
      align: "right",
      color: "rgba(0,0,0,0.55)",
      context,
      font: "600 9px Arial, sans-serif",
      lineHeight: 10,
      maxLines: 1,
      maxWidth: 140,
      text: formatFormPageCounter(
        pageIndex + 1,
        source.printableFormPages.length,
        source.exportLanguage,
      ),
      x: contentX + contentWidth - 140,
      y: y + 2,
    });
  }

  const addressHeight = hasCompanyAddress && !shouldStackAddressHeader
    ? drawTextBlock({
        align: "right",
        color: "rgba(0,0,0,0.64)",
        context,
        font: "400 10px Arial, sans-serif",
        lineHeight: 14,
        maxLines: Number.MAX_SAFE_INTEGER,
        maxWidth: rightHeaderWidth,
        text: trimmedCompanyAddress,
        x: contentX + contentWidth - rightHeaderWidth,
        y: y + (source.printableFormPages.length > 1 ? 18 : 4),
      })
    : 0;
  const sideAddressBottom = hasCompanyAddress && !shouldStackAddressHeader
    ? y + (source.printableFormPages.length > 1 ? 18 : 4) + addressHeight
    : 0;
  const stackedAddressY = titleY + 24;
  const stackedAddressHeight =
    hasCompanyAddress && shouldStackAddressHeader
      ? drawTextBlock({
          color: "rgba(0,0,0,0.64)",
          context,
          font: "400 9px Arial, sans-serif",
          lineHeight: 12,
          maxLines: 8,
          maxWidth: contentWidth,
          text: trimmedCompanyAddress,
          x: contentX,
          y: stackedAddressY,
        })
      : 0;
  const stackedAddressBottom = stackedAddressHeight
    ? stackedAddressY + stackedAddressHeight
    : 0;
  const headerBottom = Math.max(y + logoSize, titleY + 18, sideAddressBottom, stackedAddressBottom);
  drawHorizontalRule(context, contentX, headerBottom + 10, contentWidth, "rgba(0,0,0,0.25)");
  y = headerBottom + 26;

  drawInfoLine({
    context,
    label: source.exportCopy.date,
    value: formatExportDate(source.expenseDate, source.exportLanguage),
    width: leftInfoWidth,
    x: contentX,
    y,
  });
  drawInfoLine({
    context,
    label: source.exportCopy.employee,
    value: source.employeeName,
    width: rightInfoWidth,
    x: rightInfoX,
    y,
  });

  drawInfoLine({
    context,
    label: source.exportCopy.department,
    value: source.department || "-",
    width: leftInfoWidth,
    x: contentX,
    y: y + 68,
  });

  drawInfoLine({
    context,
    label: source.exportCopy.reference,
    reserveWritingSpace: true,
    value: BLANK_PRINT_FIELD_VALUE,
    width: rightInfoWidth,
    x: rightInfoX,
    y: y + 68,
  });

  y += 148;

  drawTextBlock({
    color: "rgba(0,0,0,0.55)",
    context,
    font: "600 10px Arial, sans-serif",
    lineHeight: 11,
    maxLines: 1,
    maxWidth: contentWidth,
    text: source.exportCopy.note.toUpperCase(),
    x: contentX,
    y,
  });

  const noteTextHeight = drawTextBlock({
    context,
    font: "400 11px Arial, sans-serif",
    lineHeight: 16,
    maxLines: 8,
    maxWidth: contentWidth,
    text: source.note || source.exportCopy.noteFallback,
    x: contentX,
    y: y + 18,
  });
  const noteRuleY = y + 18 + Math.max(noteTextHeight, 16) + 12;
  drawHorizontalRule(context, contentX, noteRuleY, contentWidth, "rgba(0,0,0,0.15)");
  y = noteRuleY + 16;

  const tableX = contentX;
  const tableY = y;
  const tableHeaderHeight = 30;
  const rowHeights = rows.map(({ lineNumber, row }) => {
    const lineHeight = measureTextBlockHeight({
      context,
      font: "700 8px Arial, sans-serif",
      lineHeight: 10,
      maxLines: 4,
      maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[0] ?? 0) - 16,
      text: formatExpenseLineReferenceCode(
        source.expenseDate,
        lineNumber,
        source.displayExpenseReference,
      ),
    });
    const expenseTypeHeight = measureTextBlockHeight({
      context,
      font: "600 11px Arial, sans-serif",
      lineHeight: 13,
      maxLines: 8,
      maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[1] ?? 0) - 16,
      text: formatExportExpenseTypeLabel(row.typeId, source.exportLanguage),
    });
    const remarkHeight = measureTextBlockHeight({
      context,
      font: "400 10px Arial, sans-serif",
      lineHeight: 13,
      maxLines: 18,
      maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[2] ?? 0) - 16,
      text: row.remark || source.exportCopy.emptyRemark,
    });
    const amountHeight = measureTextBlockHeight({
      context,
      font: "600 11px Arial, sans-serif",
      lineHeight: 13,
      maxLines: 2,
      maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[3] ?? 0) - 16,
      text: row.amount.trim()
        ? formatPrintAmount(parseAmount(row.amount), source.exportLanguage)
        : "-",
    });

    return Math.max(38, lineHeight, expenseTypeHeight, remarkHeight, amountHeight) + 14;
  });
  const tableHeight =
    rows.length === 0
      ? 48
      : tableHeaderHeight + rowHeights.reduce((sum, height) => sum + height, 0);

  context.save();
  context.fillStyle = "rgba(0,0,0,0.035)";
  context.fillRect(tableX, tableY, contentWidth, tableHeaderHeight);
  context.restore();

  context.save();
  context.strokeStyle = "rgba(0,0,0,0.4)";
  context.lineWidth = 1;
  context.strokeRect(tableX, tableY, contentWidth, tableHeight);
  context.restore();

  const columnLefts = EXPORT_TABLE_COLUMN_WIDTHS_PX.reduce<number[]>(
    (positions, width, index) => {
      if (index === 0) {
        return [tableX];
      }

      return [...positions, positions[index - 1] + EXPORT_TABLE_COLUMN_WIDTHS_PX[index - 1]];
    },
    [],
  );

  EXPORT_TABLE_COLUMN_WIDTHS_PX.slice(0, -1).forEach((width, index) => {
    const dividerX = (columnLefts[index] ?? tableX) + width;
    context.save();
    context.beginPath();
    context.strokeStyle = "rgba(0,0,0,0.25)";
    context.moveTo(dividerX, tableY);
    context.lineTo(dividerX, tableY + tableHeight);
    context.stroke();
    context.restore();
  });

  context.save();
  context.beginPath();
  context.strokeStyle = "rgba(0,0,0,0.35)";
  context.moveTo(tableX, tableY + tableHeaderHeight);
  context.lineTo(tableX + contentWidth, tableY + tableHeaderHeight);
  context.stroke();
  context.restore();

  [
    source.exportCopy.line,
    source.exportCopy.expenseType,
    source.exportCopy.expenseNote,
    source.exportCopy.amount,
  ].forEach((label, index) => {
    drawTextBlock({
      align: index === 3 ? "right" : "left",
      color: "rgba(0,0,0,0.85)",
      context,
      font: "700 8px Arial, sans-serif",
      lineHeight: 10,
      maxLines: 1,
      maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[index] ?? 0) - 16,
      text: label.toUpperCase(),
      x: (columnLefts[index] ?? tableX) + 8,
      y: tableY + 10,
    });
  });

  if (rows.length === 0) {
    drawTextBlock({
      color: "rgba(0,0,0,0.6)",
      context,
      font: "400 13px Arial, sans-serif",
      lineHeight: 16,
      maxLines: 2,
      maxWidth: contentWidth - 20,
      text: source.exportCopy.noExpenses,
      x: tableX + 10,
      y: tableY + tableHeaderHeight + 12,
    });
  } else {
    let rowTop = tableY + tableHeaderHeight;

    rows.forEach(({ lineNumber, row }, rowIndex) => {
      const rowHeight = rowHeights[rowIndex] ?? 38;

      context.save();
      context.beginPath();
      context.strokeStyle = "rgba(0,0,0,0.25)";
      context.moveTo(tableX, rowTop + rowHeight);
      context.lineTo(tableX + contentWidth, rowTop + rowHeight);
      context.stroke();
      context.restore();

      drawTextBlock({
        color: "#000000",
        context,
        font: "700 8px Arial, sans-serif",
        lineHeight: 10,
        maxLines: 4,
        maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[0] ?? 0) - 16,
        text: formatExpenseLineReferenceCode(
          source.expenseDate,
          lineNumber,
          source.displayExpenseReference,
        ),
        x: tableX + 8,
        y: rowTop + 8,
      });

      drawTextBlock({
        color: "#000000",
        context,
        font: "600 11px Arial, sans-serif",
        lineHeight: 13,
        maxLines: 8,
        maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[1] ?? 0) - 16,
        text: formatExportExpenseTypeLabel(row.typeId, source.exportLanguage),
        x: (columnLefts[1] ?? tableX) + 8,
        y: rowTop + 7,
      });

      drawTextBlock({
        color: "rgba(0,0,0,0.78)",
        context,
        font: "400 10px Arial, sans-serif",
        lineHeight: 13,
        maxLines: 18,
        maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[2] ?? 0) - 16,
        text: row.remark || source.exportCopy.emptyRemark,
        x: (columnLefts[2] ?? tableX) + 8,
        y: rowTop + 7,
      });

      drawTextBlock({
        align: "right",
        color: "#000000",
        context,
        font: "600 11px Arial, sans-serif",
        lineHeight: 13,
        maxLines: 1,
        maxWidth: (EXPORT_TABLE_COLUMN_WIDTHS_PX[3] ?? 0) - 16,
        text: row.amount.trim()
          ? formatPrintAmount(parseAmount(row.amount), source.exportLanguage)
          : "-",
        x: (columnLefts[3] ?? tableX) + 8,
        y: rowTop + 11,
      });

      rowTop += rowHeight;
    });
  }

  if (pageIndex === source.printableFormPages.length - 1) {
    const fixedFooterTop = EXPORT_PAGE_HEIGHT_PX - EXPORT_PAGE_PADDING_PX - 154;
    const footerTop = Math.max(tableY + tableHeight + 18, fixedFooterTop);
    drawHorizontalRule(context, contentX, footerTop, contentWidth, "rgba(0,0,0,0.25)");

    drawTextBlock({
      align: "right",
      color: "rgba(0,0,0,0.55)",
      context,
      font: "700 9px Arial, sans-serif",
      lineHeight: 10,
      maxLines: 1,
      maxWidth: contentWidth,
      text: source.exportCopy.total.toUpperCase(),
      x: contentX,
      y: footerTop + 10,
    });

    drawTextBlock({
      align: "right",
      context,
      font: "700 24px Arial, sans-serif",
      lineHeight: 26,
      maxLines: 1,
      maxWidth: contentWidth,
      text: formatPrintAmount(source.totalAmount, source.exportLanguage),
      x: contentX,
      y: footerTop + 24,
    });

    const signatureTop = footerTop + 74;
    const signatureGap = 14;
    const signatureWidth = (contentWidth - signatureGap * 2) / 3;

    source.exportCopy.signatures.forEach((label, signatureIndex) => {
      const signatureX = contentX + signatureIndex * (signatureWidth + signatureGap);
      const centeredX = signatureX + signatureWidth / 2;

      context.save();
      context.fillStyle = "#000000";
      context.font = "600 9px Arial, sans-serif";
      const hintWidth = context.measureText(source.exportCopy.signatureHint).width;
      context.fillText(source.exportCopy.signatureHint, centeredX - hintWidth / 2, signatureTop);
      context.restore();

      drawHorizontalRule(
        context,
        signatureX,
        signatureTop + 34,
        signatureWidth,
        "rgba(0,0,0,0.75)",
      );

      context.save();
      context.fillStyle = "rgba(0,0,0,0.8)";
      context.font = "400 9px Arial, sans-serif";
      const labelWidth = context.measureText(label).width;
      context.fillText(label, centeredX - labelWidth / 2, signatureTop + 44);
      context.restore();
    });
  }

  return canvas;
}

async function renderReceiptPageCanvas(
  source: ExportPdfSource,
  entries: PrintableReceiptEntry[],
  pageIndex: number,
  imageCache: Map<string, Promise<HTMLImageElement | null>>,
) {
  const { canvas, context } = createExportPageCanvas();
  const contentX = EXPORT_PAGE_PADDING_PX;
  const contentWidth = EXPORT_CONTENT_WIDTH_PX;
  const gridGap = 18;
  const cellWidth = (contentWidth - gridGap) / 2;
  const itemHeight = 430;
  const imageHeight = 300;
  let y = EXPORT_PAGE_PADDING_PX;

  drawTextBlock({
    color: "rgba(0,0,0,0.55)",
    context,
    font: "600 10px Arial, sans-serif",
    lineHeight: 11,
    maxLines: 1,
    maxWidth: contentWidth,
    text: source.exportCopy.receiptsSheetTitle.toUpperCase(),
    x: contentX,
    y,
  });

  drawTextBlock({
    color: "rgba(0,0,0,0.65)",
    context,
    font: "400 12px Arial, sans-serif",
    lineHeight: 14,
    maxLines: 1,
    maxWidth: contentWidth,
    text: formatReceiptPageCounter(pageIndex + 1, source.receiptPages.length, source.exportLanguage),
    x: contentX,
    y: y + 18,
  });

  drawHorizontalRule(context, contentX, y + 44, contentWidth, "rgba(0,0,0,0.25)");
  y += 60;

  for (const [entryIndex, entry] of entries.entries()) {
    const columnIndex = entryIndex % 2;
    const rowIndex = Math.floor(entryIndex / 2);
    const cardX = contentX + columnIndex * (cellWidth + gridGap);
    const cardY = y + rowIndex * (itemHeight + gridGap);
    const receiptPreviewUrl =
      source.assetUrlMap[entry.receipt.previewUrl] ?? entry.receipt.previewUrl;
    const receiptImage = await loadCanvasImage(receiptPreviewUrl, imageCache);

    drawTextBlock({
      color: "rgba(0,0,0,0.55)",
      context,
      font: "600 9px Arial, sans-serif",
      lineHeight: 11,
      maxLines: 1,
      maxWidth: cellWidth,
      text: entry.label.toUpperCase(),
      x: cardX,
      y: cardY,
    });

    drawTextBlock({
      color: "rgba(0,0,0,0.65)",
      context,
      font: "400 11px Arial, sans-serif",
      lineHeight: 13,
      maxLines: 1,
      maxWidth: cellWidth,
      text: formatExportExpenseTypeLabel(entry.row.typeId, source.exportLanguage),
      x: cardX,
      y: cardY + 18,
    });

    context.save();
    context.strokeStyle = "rgba(0,0,0,0.25)";
    context.strokeRect(cardX, cardY + 44, cellWidth, imageHeight);
    context.restore();

    if (receiptImage) {
      drawImageContain({
        context,
        height: imageHeight - 16,
        image: receiptImage,
        width: cellWidth - 16,
        x: cardX + 8,
        y: cardY + 52,
      });
    } else {
      drawTextBlock({
        color: "rgba(0,0,0,0.45)",
        context,
        font: "500 12px Arial, sans-serif",
        lineHeight: 14,
        maxLines: 2,
        maxWidth: cellWidth - 24,
        text: "Receipt image unavailable",
        x: cardX + 12,
        y: cardY + 170,
      });
    }

    drawTextBlock({
      color: "rgba(0,0,0,0.6)",
      context,
      font: "400 10px Arial, sans-serif",
      lineHeight: 12,
      maxLines: 1,
      maxWidth: cellWidth,
      text: entry.receipt.name,
      x: cardX,
      y: cardY + imageHeight + 56,
    });
  }

  return canvas;
}

async function createExportPdfBlob(source: ExportPdfSource) {
  const [{ jsPDF }] = await Promise.all([import("jspdf")]);
  const pdf = new jsPDF({
    compress: true,
    format: "a4",
    orientation: "portrait",
    unit: "mm",
  });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
  let renderedPageIndex = 0;

  for (const [formPageIndex, pageRows] of source.printableFormPages.entries()) {
    const canvas = await renderFormPageCanvas(source, pageRows, formPageIndex, imageCache);

    if (renderedPageIndex > 0) {
      pdf.addPage("a4", "portrait");
    }

    pdf.addImage(canvas, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    renderedPageIndex += 1;
  }

  for (const [receiptPageIndex, pageEntries] of source.receiptPages.entries()) {
    const canvas = await renderReceiptPageCanvas(
      source,
      pageEntries,
      receiptPageIndex,
      imageCache,
    );

    if (renderedPageIndex > 0) {
      pdf.addPage("a4", "portrait");
    }

    pdf.addImage(canvas, "PNG", 0, 0, pdfWidth, pdfHeight, undefined, "FAST");
    renderedPageIndex += 1;
  }

  const exportBlob = pdf.output("blob");
  return exportBlob;
}

function getExportFilePicker() {
  const saveWindow = window as Window & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        accept: Record<string, string[]>;
        description: string;
      }>;
    }) => Promise<ExportFileHandle>;
  };

  return window.isSecureContext ? saveWindow.showSaveFilePicker ?? null : null;
}

async function requestExportFileHandle(fileName: string) {
  const showSaveFilePicker = getExportFilePicker();

  if (!showSaveFilePicker) {
    return null;
  }

  try {
    return await showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          accept: {
            "application/pdf": [".pdf"],
          },
          description: "PDF document",
        },
      ],
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }

    throw error;
  }
}

function buildExportDeliveryTargets(
  blob: Blob,
  fileName: string,
  preferShare: boolean,
) {
  const targets: ExportDeliveryTarget[] = [];
  const shareNavigator = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  const pdfFile =
    typeof File === "function"
      ? new File([blob], fileName, { type: "application/pdf" })
      : null;

  if (
    preferShare &&
    pdfFile &&
    typeof shareNavigator.share === "function" &&
    shareNavigator.canShare?.({ files: [pdfFile] })
  ) {
    targets.push({
      file: pdfFile,
      kind: "share",
    });
  }

  if (getExportFilePicker()) {
    targets.push({
      fileName,
      kind: "file-picker",
    });
  }

  if (preferShare) {
    targets.push({
      fileName,
      kind: "open",
    });
  }

  targets.push({
    fileName,
    kind: "download",
  });

  return targets;
}

function triggerPdfDownload(blob: Blob, fileName: string, message: string) {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.style.display = "none";
  anchor.href = blobUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

  return {
    kind: "downloaded",
    message,
  } satisfies ExportDeliveryResult;
}

function deliverExportDownload(blob: Blob, fileName: string): ExportDeliveryResult {
  return triggerPdfDownload(blob, fileName, "PDF download started.");
}

async function deliverExportPdf({
  blob,
  fileName,
  preferShare,
}: {
  blob: Blob;
  fileName: string;
  preferShare: boolean;
}) {
  const shareNavigator = navigator as Navigator & {
    share?: (data?: ShareData) => Promise<void>;
  };
  const deliveryTargets = buildExportDeliveryTargets(blob, fileName, preferShare);
  let lastError: unknown = null;

  for (const target of deliveryTargets) {
    try {
      if (target.kind === "share") {
        if (typeof shareNavigator.share !== "function") {
          continue;
        }

        await shareNavigator.share({
          files: [target.file],
          title: target.file.name,
        });

        return {
          kind: "shared",
          message: "Share sheet opened.",
        } satisfies ExportDeliveryResult;
      }

      if (target.kind === "file-picker") {
        const fileHandle = await requestExportFileHandle(target.fileName);

        if (!fileHandle) {
          return {
            kind: "cancelled",
            message: null,
          } satisfies ExportDeliveryResult;
        }

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        return {
          kind: "saved",
          message: "PDF saved to your device.",
        } satisfies ExportDeliveryResult;
      }

      if (target.kind === "open") {
        const blobUrl = URL.createObjectURL(blob);
        const exportWindow = window.open(blobUrl, "_blank");

        if (!exportWindow) {
          URL.revokeObjectURL(blobUrl);
          return triggerPdfDownload(
            blob,
            target.fileName,
            "PDF download started because your browser blocked opening a new tab.",
          );
        }

        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

        return {
          kind: "opened",
          message: "PDF opened in a new tab.",
        } satisfies ExportDeliveryResult;
      }

      return triggerPdfDownload(blob, target.fileName, "PDF download started.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return {
          kind: "cancelled",
          message: null,
        } satisfies ExportDeliveryResult;
      }

      lastError = error;
    }
  }

  throw lastError ?? new Error("No supported PDF delivery path was available.");
}

function DesktopExportPreviewPageCard({
  children,
  scale,
}: {
  children: ReactNode;
  scale: number;
}) {
  return (
    <div className="export-preview-frame mx-auto max-w-full">
      <div
        className="overflow-hidden"
        style={{
          height: `${EXPORT_PAGE_HEIGHT_PX * scale}px`,
          width: `${EXPORT_PAGE_WIDTH_PX * scale}px`,
        }}
      >
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${scale})`,
            width: `${EXPORT_PAGE_WIDTH_PX}px`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function MobileExportPreviewPageCard({
  children,
  label,
  scale,
}: {
  children: ReactNode;
  label: string;
  scale: number;
}) {
  return (
    <article className="rounded-[1.45rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-2 shadow-[0_18px_52px_-34px_rgba(15,23,42,0.55)]">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <Badge className="rounded-full px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.2em]" variant="secondary">
          {label}
        </Badge>
        <p className="text-[0.64rem] uppercase tracking-[0.22em] text-muted-foreground">
          Mobile fit
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.1rem] border border-black/8 bg-[linear-gradient(180deg,#edf2ed,#e2e9e2)] p-1.5">
        <div
          className="mx-auto overflow-hidden rounded-[0.9rem] bg-white"
          style={{
            height: `${EXPORT_PAGE_HEIGHT_PX * scale}px`,
            width: `${EXPORT_PAGE_WIDTH_PX * scale}px`,
          }}
        >
          <div
            className="origin-top-left"
            style={{
              transform: `scale(${scale})`,
              width: `${EXPORT_PAGE_WIDTH_PX}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </article>
  );
}

function ProtectedExpenseEditor({
  expenseDate,
  logout,
  session,
}: {
  expenseDate: string;
  logout: () => Promise<void>;
  session: AuthSession;
}) {
  const defaultEmployeeName = deriveDisplayName(session.userEmail);
  const cacheUserKey = session.userEmail;
  const [department, setDepartment] = useState("");
  const [employeeName, setEmployeeName] = useState(defaultEmployeeName);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loadedCompanyId, setLoadedCompanyId] = useState("");
  const [loadedCompanyAddress, setLoadedCompanyAddress] = useState("");
  const [loadedCompanyName, setLoadedCompanyName] = useState("");
  const [loadedCompanyTaxId, setLoadedCompanyTaxId] = useState("");
  const [loadedCompanyLogoBucketName, setLoadedCompanyLogoBucketName] = useState("");
  const [loadedCompanyLogoObjectPath, setLoadedCompanyLogoObjectPath] = useState("");
  const [loadedCompanyLogoUrl, setLoadedCompanyLogoUrl] = useState("");
  const [exportLanguage, setExportLanguage] = useState<ExportLanguage>("en");
  const [note, setNote] = useState("");
  const [expenseCode, setExpenseCode] = useState("");
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastPrintedAt, setLastPrintedAt] = useState<string | null>(null);
  const [exportFeedbackMessage, setExportFeedbackMessage] = useState<string | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [isFormDetailsOpen, setIsFormDetailsOpen] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [isMobileExportPreview, setIsMobileExportPreview] = useState(false);
  const [exportPreviewScale, setExportPreviewScale] = useState(1);
  const [exportAssetUrlMap, setExportAssetUrlMap] = useState<Record<string, string>>({});
  const [printError, setPrintError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const pendingSaveRef = useRef<PendingSaveSnapshot | null>(null);
  const isPersistingRef = useRef(false);
  const activeSavePromiseRef = useRef<Promise<string | null> | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const skipNextDraftWriteRef = useRef(true);
  const hasLoadedDocumentRef = useRef(false);
  const latestDraftSnapshotRef = useRef<ExpenseDraftSnapshot | null>(null);
  const exportAssetObjectUrlsRef = useRef<string[]>([]);
  const exportPreviewViewportRef = useRef<HTMLDivElement | null>(null);

  const applyLoadedDocument = useEffectEvent((
    existingReport: ExpenseDayDocument | null,
    nextCompanies: CompanyRecord[],
    hydratedDraft: HydratedExpenseDraft | null,
    savedProfile: UserProfile | null,
  ) => {
    setCompanies(nextCompanies);
    setDocumentError(null);

    const defaultProfileName = savedProfile?.fullName.trim() || defaultEmployeeName;
    const defaultProfileDepartment = savedProfile?.department.trim() || "";

    if (!existingReport && !hydratedDraft) {
      setDepartment(limitTextLength(defaultProfileDepartment, DEPARTMENT_MAX_LENGTH));
      setEmployeeName(limitTextLength(defaultProfileName, EMPLOYEE_NAME_MAX_LENGTH));
      setSelectedCompanyId("");
      setLoadedCompanyId("");
      setLoadedCompanyAddress("");
      setLoadedCompanyName("");
      setLoadedCompanyTaxId("");
      setLoadedCompanyLogoBucketName("");
      setLoadedCompanyLogoObjectPath("");
      setLoadedCompanyLogoUrl("");
      setExportLanguage("en");
      setExpenseCode("");
      setNote("");
      setRows([]);
    } else {
      setDepartment(
        limitTextLength(
          hydratedDraft?.department.trim() ||
            existingReport?.department.trim() ||
            defaultProfileDepartment,
          DEPARTMENT_MAX_LENGTH,
        ),
      );
      setEmployeeName(
        limitTextLength(
          hydratedDraft?.employeeName.trim() ||
            existingReport?.employeeName.trim() ||
            defaultProfileName,
          EMPLOYEE_NAME_MAX_LENGTH,
        ),
      );
      setSelectedCompanyId(hydratedDraft?.companyId ?? existingReport?.companyId ?? "");
      setLoadedCompanyId(existingReport?.companyId ?? "");
      setLoadedCompanyAddress(existingReport?.companyAddress ?? "");
      setLoadedCompanyName(existingReport?.companyName ?? "");
      setLoadedCompanyTaxId(existingReport?.companyTaxId ?? "");
      setLoadedCompanyLogoBucketName(existingReport?.companyLogoBucketName ?? "");
      setLoadedCompanyLogoObjectPath(existingReport?.companyLogoObjectPath ?? "");
      setLoadedCompanyLogoUrl(existingReport?.companyLogoUrl ?? "");
      setExportLanguage(hydratedDraft?.exportLanguage ?? existingReport?.exportLanguage ?? "en");
      setExpenseCode(existingReport?.expenseCode ?? "");
      setNote(
        limitTextLength(
          hydratedDraft?.note ?? existingReport?.note ?? "",
          EXPORT_NOTE_MAX_LENGTH,
        ),
      );
      setRows(
        limitExpenseRowsForExport(
          hydratedDraft?.rows ??
            (existingReport ? buildRowsFromLoadedReport(existingReport.rows) : []),
        ),
      );
    }

    skipNextAutosaveRef.current = true;
    skipNextDraftWriteRef.current = true;
    latestDraftSnapshotRef.current = null;
    hasLoadedDocumentRef.current = true;
  });

  const loadDocument = useEffectEvent(
    async (
      nextCacheUserKey: string,
      nextExpenseDate: string,
      isActive: () => boolean,
    ) => {
      const cachedCompanies = readCompaniesCache(nextCacheUserKey);
      const cachedExpenseDay = readExpenseDayCache(nextCacheUserKey, nextExpenseDate);
      const cachedDraft = readExpenseDraftCache(nextCacheUserKey, nextExpenseDate);
      const savedProfilePromise = getUserProfile(session.accessToken).catch((error: unknown) => {
        if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) {
          throw error;
        }

        return null;
      });

      const [savedProfile, nextCompanies, existingReport] = await Promise.all([
        savedProfilePromise,
        cachedCompanies
          ? Promise.resolve(cachedCompanies)
          : listUserCompanies(session.accessToken),
        cachedExpenseDay
          ? Promise.resolve(cachedExpenseDay)
          : getExpenseDay(session.accessToken, nextExpenseDate),
      ]);

      if (!isActive()) {
        return;
      }

      if (!cachedCompanies) {
        writeCompaniesCache(nextCacheUserKey, nextCompanies);
      }

      if (existingReport && !cachedExpenseDay) {
        writeExpenseDayCache(nextCacheUserKey, nextExpenseDate, existingReport);
      }

      let hydratedDraft: HydratedExpenseDraft | null = null;

      if (cachedDraft) {
        try {
          hydratedDraft = {
            companyId: cachedDraft.companyId,
            department: cachedDraft.department,
            employeeName: cachedDraft.employeeName,
            exportLanguage: cachedDraft.exportLanguage,
            note: cachedDraft.note,
            rows: hydrateDraftRows(cachedDraft.rows),
          };
        } catch {
          clearExpenseDraftCache(nextCacheUserKey, nextExpenseDate);
        }
      }

      applyLoadedDocument(existingReport, nextCompanies, hydratedDraft, savedProfile);
    },
  );

  const handleLoadDocumentError = useEffectEvent((error: unknown) => {
    if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) {
      void logout();
      return;
    }

    setDocumentError(getFriendlyEditorError(error, "load"));
  });

  useEffect(() => {
    let isActive = true;

    // Keep the editor state stable during auth/account refreshes. Re-load only when the
    // actual document identity changes, and use the latest session inside the effect event.
    void loadDocument(cacheUserKey, expenseDate, () => isActive)
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        handleLoadDocumentError(error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingDocument(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [cacheUserKey, expenseDate]);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
  const shouldUseLoadedCompanySnapshot =
    !selectedCompany &&
    ((selectedCompanyId && selectedCompanyId === loadedCompanyId) ||
      (!selectedCompanyId &&
        !loadedCompanyId &&
        Boolean(loadedCompanyName.trim() || loadedCompanyLogoUrl)));
  const selectedCompanyName =
    limitTextLength(
      selectedCompany?.companyName ??
        (shouldUseLoadedCompanySnapshot ? loadedCompanyName : ""),
      COMPANY_NAME_MAX_LENGTH,
    );
  const selectedCompanyAddress =
    limitTextLength(
      selectedCompany?.companyAddress ??
        (shouldUseLoadedCompanySnapshot ? loadedCompanyAddress : ""),
      COMPANY_ADDRESS_MAX_LENGTH,
    );
  const selectedCompanyTaxId =
    limitTextLength(
      selectedCompany?.companyTaxId ??
        (shouldUseLoadedCompanySnapshot ? loadedCompanyTaxId : ""),
      COMPANY_TAX_ID_MAX_LENGTH,
    );
  const selectedCompanyLogoBucketName =
    selectedCompany?.logoBucketName ??
    (shouldUseLoadedCompanySnapshot ? loadedCompanyLogoBucketName : "");
  const selectedCompanyLogoObjectPath =
    selectedCompany?.logoObjectPath ??
    (shouldUseLoadedCompanySnapshot ? loadedCompanyLogoObjectPath : "");
  const selectedCompanyLogoUrl =
    selectedCompany?.logoUrl ?? (shouldUseLoadedCompanySnapshot ? loadedCompanyLogoUrl : "");

  const buildPendingSaveSnapshot = () =>
    ({
      companyAddress: selectedCompanyAddress,
      companyId: selectedCompanyId,
      companyLogoBucketName: selectedCompanyLogoBucketName,
      companyLogoObjectPath: selectedCompanyLogoObjectPath,
      companyName: selectedCompanyName,
      companyTaxId: selectedCompanyTaxId,
      department,
      employeeName,
      exportLanguage,
      note,
      rows,
    }) satisfies PendingSaveSnapshot;

  const persistSnapshot = async (nextSnapshot: PendingSaveSnapshot) => {
    isPersistingRef.current = true;
    setIsSavingDocument(true);

    try {
      const saveResult = await upsertExpenseDay({
        accessToken: session.accessToken,
        companyAddress: nextSnapshot.companyAddress,
        companyId: nextSnapshot.companyId,
        companyLogoBucketName: nextSnapshot.companyLogoBucketName,
        companyLogoObjectPath: nextSnapshot.companyLogoObjectPath,
        companyName: nextSnapshot.companyName,
        companyTaxId: nextSnapshot.companyTaxId,
        department: nextSnapshot.department,
        employeeName: nextSnapshot.employeeName,
        expenseDate,
        exportLanguage: nextSnapshot.exportLanguage,
        note: nextSnapshot.note,
        rows: nextSnapshot.rows,
      });

      setSaveError(null);
      setExpenseCode(saveResult.expenseCode);
      setLastSavedAt(
        new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date()),
      );

      const persistedRows = saveResult.rows
        .filter(hasRowContent)
        .map((row) => ({
          ...row,
          isExpanded: false,
          isReceiptPreviewOpen: false,
        }));
      const cachedCompanyLogoUrl = nextSnapshot.companyLogoObjectPath;

      writeExpenseDayCache(cacheUserKey, expenseDate, {
        companyAddress: nextSnapshot.companyAddress,
        companyId: nextSnapshot.companyId,
        companyLogoBucketName: nextSnapshot.companyLogoBucketName,
        companyLogoObjectPath: nextSnapshot.companyLogoObjectPath,
        companyLogoUrl: cachedCompanyLogoUrl,
        companyName: nextSnapshot.companyName,
        companyTaxId: nextSnapshot.companyTaxId,
        department: nextSnapshot.department,
        employeeName: nextSnapshot.employeeName,
        exportLanguage: nextSnapshot.exportLanguage,
        note: nextSnapshot.note,
        expenseCode: saveResult.expenseCode,
        reportId: saveResult.reportId,
        rows: persistedRows,
      });
      upsertExpenseSummaryCache(cacheUserKey, {
        date: expenseDate,
        expenseCode: saveResult.expenseCode,
        totalAmount: persistedRows.reduce((sum, row) => sum + parseAmount(row.amount), 0),
      });

      if (!pendingSaveRef.current) {
        if (draftTimerRef.current) {
          window.clearTimeout(draftTimerRef.current);
          draftTimerRef.current = null;
        }

        latestDraftSnapshotRef.current = null;
        clearExpenseDraftCache(cacheUserKey, expenseDate);
      }

      if (saveResult.didUpload) {
        skipNextAutosaveRef.current = true;
        skipNextDraftWriteRef.current = true;
        setRows(limitExpenseRowsForExport(saveResult.rows));
      }

      return saveResult.expenseCode;
    } catch (error) {
      if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) {
        void logout();
        return null;
      }

      setSaveError(
        getFriendlyEditorError(error, "save"),
      );
      return null;
    } finally {
      isPersistingRef.current = false;
      setIsSavingDocument(false);
    }
  };

  const startSave = (nextSnapshot: PendingSaveSnapshot) => {
    const nextSavePromise = persistSnapshot(nextSnapshot).finally(() => {
      if (activeSavePromiseRef.current === nextSavePromise) {
        activeSavePromiseRef.current = null;
      }

      if (pendingSaveRef.current) {
        const queuedSnapshot = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void startSave(queuedSnapshot);
      }
    });

    activeSavePromiseRef.current = nextSavePromise;
    return nextSavePromise;
  };

  const flushPendingSaveNow = async () => {
    if (isPersistingRef.current) {
      return activeSavePromiseRef.current;
    }

    const nextSnapshot = pendingSaveRef.current;

    if (!nextSnapshot) {
      return null;
    }

    pendingSaveRef.current = null;
    return startSave(nextSnapshot);
  };

  const flushPendingSave = useEffectEvent(async () => flushPendingSaveNow());

  const flushDraftToCache = useEffectEvent((draftSnapshot?: ExpenseDraftSnapshot | null) => {
    const nextDraftSnapshot = draftSnapshot ?? latestDraftSnapshotRef.current;

    if (draftTimerRef.current) {
      window.clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }

    if (!nextDraftSnapshot) {
      return;
    }

    latestDraftSnapshotRef.current = nextDraftSnapshot;
    writeExpenseDraftCache(cacheUserKey, expenseDate, nextDraftSnapshot);
  });

  const ensureDocumentPersistedForExport = async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    let resolvedExpenseCode = expenseCode.trim();

    while (pendingSaveRef.current || isPersistingRef.current) {
      const nextExpenseCode = await flushPendingSaveNow();

      if (nextExpenseCode?.trim()) {
        resolvedExpenseCode = nextExpenseCode;
      }
    }

    if (resolvedExpenseCode) {
      return resolvedExpenseCode;
    }

    const persistedExpenseCode = await startSave(buildPendingSaveSnapshot());

    if (persistedExpenseCode?.trim()) {
      return persistedExpenseCode;
    }

    throw new Error("Expense reference was not ready for export.");
  };

  useEffect(() => {
    if (!hasLoadedDocumentRef.current) {
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    pendingSaveRef.current = {
      companyAddress: selectedCompanyAddress,
      companyId: selectedCompanyId,
      companyLogoBucketName: selectedCompanyLogoBucketName,
      companyLogoObjectPath: selectedCompanyLogoObjectPath,
      companyName: selectedCompanyName,
      companyTaxId: selectedCompanyTaxId,
      department,
      employeeName,
      exportLanguage,
      note,
      rows,
    };

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void flushPendingSave();
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    department,
    employeeName,
    exportLanguage,
    note,
    rows,
    selectedCompanyId,
    selectedCompanyAddress,
    selectedCompanyLogoBucketName,
    selectedCompanyLogoObjectPath,
    selectedCompanyName,
    selectedCompanyTaxId,
  ]);

  useEffect(() => {
    if (!hasLoadedDocumentRef.current) {
      return;
    }

    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false;
      return;
    }

    const nextDraftSnapshot = {
      companyId: selectedCompanyId,
      department,
      employeeName,
      exportLanguage,
      note,
      rows: serializeRowsForDraft(rows),
    } satisfies ExpenseDraftSnapshot;
    latestDraftSnapshotRef.current = nextDraftSnapshot;

    if (draftTimerRef.current) {
      window.clearTimeout(draftTimerRef.current);
    }

    draftTimerRef.current = window.setTimeout(() => {
      flushDraftToCache(nextDraftSnapshot);
    }, 250);

    return () => {
      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current);
        draftTimerRef.current = null;
      }
    };
  }, [department, employeeName, exportLanguage, note, rows, selectedCompanyId]);

  useEffect(() => {
    document
      .querySelectorAll<HTMLTextAreaElement>("textarea[data-auto-resize='true']")
      .forEach((textarea) => {
        resizeTextareaElement(textarea);
      });
  }, [note, rows]);

  const flushDraftAndPendingWork = useEffectEvent(() => {
    flushDraftToCache();

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (pendingSaveRef.current || isPersistingRef.current) {
      void flushPendingSave();
    }
  });

  useEffect(() => {
    const handlePageHide = () => {
      flushDraftAndPendingWork();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushDraftAndPendingWork();
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileLayout = () => {
      setIsMobileLayout(mediaQuery.matches);
    };

    syncMobileLayout();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMobileLayout);

      return () => {
        mediaQuery.removeEventListener("change", syncMobileLayout);
      };
    }

    mediaQuery.addListener(syncMobileLayout);

    return () => {
      mediaQuery.removeListener(syncMobileLayout);
    };
  }, []);

  useEffect(() => {
    if (!isExportPreviewOpen || !exportPreviewViewportRef.current) {
      return;
    }

    const viewport = exportPreviewViewportRef.current;

    const syncPreviewScale = () => {
      const nextIsMobilePreview = viewport.clientWidth < 768;
      const availableWidth = Math.max(220, viewport.clientWidth - (nextIsMobilePreview ? 12 : 0));
      const widthScale = availableWidth / EXPORT_PAGE_WIDTH_PX;

      setIsMobileExportPreview(nextIsMobilePreview);

      if (nextIsMobilePreview) {
        const availableHeight = Math.max(240, viewport.clientHeight - 24);
        const heightScale = availableHeight / EXPORT_PAGE_HEIGHT_PX;
        const nextScale = Math.min(0.78, Math.max(0.22, Math.min(widthScale, heightScale)));

        setExportPreviewScale(nextScale);
        return;
      }

      const nextScale = Math.min(1, Math.max(0.34, widthScale));
      setExportPreviewScale(nextScale);
    };

    syncPreviewScale();

    const resizeObserver = new ResizeObserver(() => {
      syncPreviewScale();
    });

    resizeObserver.observe(viewport);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isExportPreviewOpen]);

  useEffect(() => {
    if (isMobileLayout && isExportPreviewOpen) {
      setIsExportPreviewOpen(false);
    }
  }, [isExportPreviewOpen, isMobileLayout]);

  useEffect(() => {
    return () => {
      for (const objectUrl of exportAssetObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

  const rowNumberById = new Map(rows.map((row, index) => [row.id, index + 1]));
  const populatedRows = rows.filter(hasRowContent);
  const populatedRowsWithLineNumbers: PrintableFormRow[] = populatedRows.map((row, index) => ({
    lineNumber: index + 1,
    row,
  }));
  const displayExpenseReference = formatExpenseReferenceCode(expenseDate, expenseCode);
  const printableEmployeeName = employeeName || defaultEmployeeName;
  const totalAmount = rows.reduce((sum, row) => sum + parseAmount(row.amount), 0);
  const totalReceipts = rows.reduce((sum, row) => sum + row.receipts.length, 0);
  const printableDepartment = department.trim();
  const exportCopy = EXPORT_COPY[exportLanguage];
  const hasStoredCompanySnapshot = Boolean(loadedCompanyName.trim() || loadedCompanyLogoUrl);
  const printableFormPages =
    populatedRowsWithLineNumbers.length > 0
      ? chunkEntries(populatedRowsWithLineNumbers, EXPORT_FORM_ROWS_PER_PAGE)
      : [populatedRowsWithLineNumbers];
  const exportValidationMessage =
    !selectedCompanyName.trim()
      ? companies.length === 0 && !hasStoredCompanySnapshot
        ? "Add a company profile with a logo in Company details before exporting."
        : "Select a company profile before exporting."
      : !selectedCompanyLogoUrl
        ? "The selected company profile is missing a logo. Update it in Company details before exporting."
        : null;
  const canExport = exportValidationMessage === null;
  const jumpToMobileSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const printableReceipts: PrintableReceiptEntry[] = populatedRowsWithLineNumbers.flatMap(
    ({ lineNumber, row }) =>
    row.receipts.map((receipt, receiptIndex) => ({
      key: `${row.id}-${receipt.id}`,
      label: `${exportCopy.receiptLabel} - ${formatExpenseLineReferenceCode(
        expenseDate,
        lineNumber,
        expenseCode,
      )}${
        row.receipts.length > 1 ? `.${receiptIndex + 1}` : ""
      }`,
      lineNumber,
      receipt,
      row,
    })),
  );
  const receiptPages = chunkEntries(printableReceipts, RECEIPTS_PER_PAGE);
  const exportSelectedCompanyLogoUrl =
    exportAssetUrlMap[selectedCompanyLogoUrl] ?? selectedCompanyLogoUrl;
  const exportPreviewPages = [
    ...printableFormPages.map((pageRows, pageIndex) => ({
      key: `form-page-${pageIndex + 1}`,
      label:
        printableFormPages.length > 1
          ? formatFormPageCounter(pageIndex + 1, printableFormPages.length, exportLanguage)
          : exportCopy.formTitle,
      node: (
        <PrintExpenseFormPage
          companyAddress={selectedCompanyAddress}
          companyTaxId={selectedCompanyTaxId}
          currentPage={pageIndex + 1}
          department={printableDepartment}
          displayExpenseReference={displayExpenseReference}
          employeeName={printableEmployeeName}
          expenseDate={expenseDate}
          exportCopy={exportCopy}
          exportLanguage={exportLanguage}
          note={note}
          rows={pageRows}
          selectedCompanyLogoUrl={exportSelectedCompanyLogoUrl}
          selectedCompanyName={selectedCompanyName}
          showFooter={pageIndex === printableFormPages.length - 1}
          totalAmount={totalAmount}
          totalPages={printableFormPages.length}
        />
      ),
    })),
    ...receiptPages.map((pageEntries, pageIndex) => ({
      key: `receipt-page-${pageIndex + 1}`,
      label: `${exportCopy.receiptsSheetTitle} ${formatReceiptPageCounter(
        pageIndex + 1,
        receiptPages.length,
        exportLanguage,
      )}`,
      node: (
        <ReceiptExportPage
          assetUrlMap={exportAssetUrlMap}
          entries={pageEntries}
          exportCopy={exportCopy}
          exportLanguage={exportLanguage}
          pageIndex={pageIndex}
          totalPages={receiptPages.length}
        />
      ),
    })),
  ];
  const isExportBusy = isPreparingPrint || isSavingPdf;
  const editorStatus = saveError
    ? {
        description: saveError,
        icon: <CircleAlert className="size-4" />,
        label: "Needs attention",
        tone:
          "border-destructive/18 bg-[linear-gradient(135deg,rgba(239,68,68,0.16),rgba(239,68,68,0.05))] text-destructive",
      }
    : isSavingDocument
      ? {
          description: "You can keep working while we update this page in the background.",
          icon: <CloudUpload className="size-4 animate-pulse" />,
          label: "Saving your latest changes",
          tone:
            "border-primary/18 bg-[linear-gradient(135deg,rgba(34,197,94,0.16),rgba(34,197,94,0.05))] text-primary",
        }
      : lastSavedAt
        ? {
            description: `Last updated ${lastSavedAt}`,
            icon: <CloudCheck className="size-4" />,
            label: "All changes saved automatically",
            tone:
              "border-primary/15 bg-[linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))] text-primary",
          }
        : {
            description: "Your changes will save automatically while you work.",
            icon: <Sparkles className="size-4" />,
            label: "Ready to start",
            tone:
              "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] text-primary",
          };

  const updateRow = <K extends keyof ExpenseRow,>(
    rowId: number,
    key: K,
    value: ExpenseRow[K],
  ) => {
    setPrintError(null);
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [key]: value,
            }
          : row,
      ),
    );
  };

  const addRow = () => {
    setPrintError(null);
    startTransition(() => {
      setRows((currentRows) => {
        const nextId =
          currentRows.length === 0
            ? 1
            : Math.max(...currentRows.map((row) => row.id)) + 1;

        return [...currentRows, createEmptyRow(nextId)];
      });
    });
  };

  const removeRow = (rowId: number) => {
    setPrintError(null);
    startTransition(() => {
      setRows((currentRows) => currentRows.filter((row) => row.id !== rowId));
    });
  };

  const removeReceipt = (rowId: number, receiptId: string) => {
    setPrintError(null);
    startTransition(() => {
      setRows((currentRows) =>
        currentRows.map((row) => {
          if (row.id !== rowId) {
            return row;
          }

          const nextReceipts = row.receipts.filter((receipt) => receipt.id !== receiptId);

          return {
            ...row,
            receipts: nextReceipts,
            isReceiptPreviewOpen: nextReceipts.length > 0 && row.isReceiptPreviewOpen,
          };
        }),
      );
    });
  };

  const toggleExpanded = (rowId: number) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              isExpanded: !row.isExpanded,
            }
          : row,
      ),
    );
  };

  const toggleReceiptPreview = (rowId: number) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              isReceiptPreviewOpen: !row.isReceiptPreviewOpen,
            }
          : row,
      ),
    );
  };

  const handleReceiptChange = async (rowId: number, files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    let nextReceipts: ReceiptDraft[];

    try {
      nextReceipts = await toReceiptDrafts(rowId, files);
      setSaveError(null);
      setPrintError(null);
    } catch (error) {
      setSaveError(getFriendlyEditorError(error, "receipt"));
      return;
    }

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              receipts: [...row.receipts, ...nextReceipts],
              isReceiptPreviewOpen: true,
            }
          : row,
      ),
    );
  };

  const handleCompanySelect = (value: string) => {
    setPrintError(null);

    if (value === EMPTY_COMPANY_VALUE) {
      setSelectedCompanyId("");
      return;
    }

    setSelectedCompanyId(value);
  };

  const requestRowRemoval = (rowId: number) => {
    const rowNumber = rowNumberById.get(rowId) ?? rowId;

    setPendingRemoval({
      kind: "row",
      rowId,
      rowReference: formatExpenseLineReferenceCode(expenseDate, rowNumber, expenseCode),
    });
  };

  const requestReceiptRemoval = (rowId: number, receipt: ReceiptDraft) => {
    const rowNumber = rowNumberById.get(rowId) ?? rowId;

    setPendingRemoval({
      kind: "receipt",
      receiptId: receipt.id,
      receiptName: receipt.name,
      rowId,
      rowReference: formatExpenseLineReferenceCode(expenseDate, rowNumber, expenseCode),
    });
  };

  const confirmPendingRemoval = () => {
    if (!pendingRemoval) {
      return;
    }

    if (pendingRemoval.kind === "row") {
      removeRow(pendingRemoval.rowId);
    } else {
      removeReceipt(pendingRemoval.rowId, pendingRemoval.receiptId);
    }

    setPendingRemoval(null);
  };

  const buildExportArtifacts = (nextExpenseCode: string) => {
    const nextPopulatedRows = rows.filter(hasRowContent);
    const nextPopulatedRowsWithLineNumbers: PrintableFormRow[] = nextPopulatedRows.map(
      (row, index) => ({
        lineNumber: index + 1,
        row,
      }),
    );
    const nextPrintableReceipts: PrintableReceiptEntry[] = nextPopulatedRowsWithLineNumbers.flatMap(
      ({ lineNumber, row }) =>
        row.receipts.map((receipt, receiptIndex) => ({
          key: `${row.id}-${receipt.id}`,
          label: `${EXPORT_COPY[exportLanguage].receiptLabel} - ${formatExpenseLineReferenceCode(
            expenseDate,
            lineNumber,
            nextExpenseCode,
          )}${row.receipts.length > 1 ? `.${receiptIndex + 1}` : ""}`,
          lineNumber,
          receipt,
          row,
        })),
    );

    return {
      companyTaxId: selectedCompanyTaxId,
      companyAddress: selectedCompanyAddress,
      department: printableDepartment,
      displayExpenseReference: formatExpenseReferenceCode(expenseDate, nextExpenseCode),
      exportCopy: EXPORT_COPY[exportLanguage],
      exportLanguage,
      note,
      printableAssetUrls: [
        selectedCompanyLogoUrl,
        ...nextPrintableReceipts.map((entry) => entry.receipt.previewUrl),
      ].filter(Boolean),
      printableEmployeeName: employeeName || defaultEmployeeName,
      printableFormPages:
        nextPopulatedRowsWithLineNumbers.length > 0
          ? chunkEntries(nextPopulatedRowsWithLineNumbers, EXPORT_FORM_ROWS_PER_PAGE)
          : [nextPopulatedRowsWithLineNumbers],
      receiptPages: chunkEntries(nextPrintableReceipts, RECEIPTS_PER_PAGE),
      selectedCompanyLogoUrl,
      selectedCompanyName,
      totalAmount: rows.reduce((sum, row) => sum + parseAmount(row.amount), 0),
    };
  };

  const prepareExportAssets = async (assetUrls: string[]) => {
    const preparedExportAssets = await buildExportAssetUrlMap(assetUrls);

    for (const objectUrl of exportAssetObjectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }

    exportAssetObjectUrlsRef.current = preparedExportAssets.objectUrls;
    setExportAssetUrlMap(preparedExportAssets.assetUrlMap);

    const areAssetsReady = await preloadPrintableAssets(
      Object.values(preparedExportAssets.assetUrlMap),
    );

    if (!areAssetsReady) {
      throw new Error("Printable assets were not ready in time.");
    }

    if ("fonts" in document) {
      await document.fonts.ready;
    }

    return preparedExportAssets.assetUrlMap;
  };

  const handlePreviewExport = async () => {
    if (isPreparingPrint || isSavingPdf) {
      return;
    }

    if (isMobileLayout) {
      await handleDirectMobileExport();
      return;
    }

    if (!canExport) {
      setPrintError(
        exportValidationMessage ?? "Select a company profile with a logo before exporting.",
      );
      return;
    }

    setPrintError(null);
    setExportFeedbackMessage(null);
    setIsPreparingPrint(true);

    try {
      const resolvedExpenseCode = await ensureDocumentPersistedForExport();
      const exportArtifacts = buildExportArtifacts(resolvedExpenseCode);

      await prepareExportAssets(exportArtifacts.printableAssetUrls);
      await waitForNextFrame();
      setIsExportPreviewOpen(true);
    } catch (error) {
      setPrintError(getFriendlyEditorError(error, "print"));
    } finally {
      setIsPreparingPrint(false);
    }
  };

  const handleDirectMobileExport = async () => {
    if (isPreparingPrint || isSavingPdf) {
      return;
    }

    if (!canExport) {
      setPrintError(
        exportValidationMessage ?? "Select a company profile with a logo before exporting.",
      );
      return;
    }

    setPrintError(null);
    setExportFeedbackMessage(null);
    setIsPreparingPrint(true);

    try {
      const resolvedExpenseCode = await ensureDocumentPersistedForExport();
      const exportArtifacts = buildExportArtifacts(resolvedExpenseCode);
      const preparedAssetUrlMap = await prepareExportAssets(exportArtifacts.printableAssetUrls);
      const exportFileName = buildExportFileName(
        exportArtifacts.displayExpenseReference,
        expenseDate,
      );
      const exportedAt = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());

      setIsPreparingPrint(false);
      setIsSavingPdf(true);

      const exportBlob = await createExportPdfBlob({
        assetUrlMap: preparedAssetUrlMap,
        companyAddress: exportArtifacts.companyAddress,
        companyTaxId: exportArtifacts.companyTaxId,
        department: exportArtifacts.department,
        displayExpenseReference: exportArtifacts.displayExpenseReference,
        employeeName: exportArtifacts.printableEmployeeName,
        expenseDate,
        exportCopy: exportArtifacts.exportCopy,
        exportLanguage: exportArtifacts.exportLanguage,
        note: exportArtifacts.note,
        printableFormPages: exportArtifacts.printableFormPages,
        receiptPages: exportArtifacts.receiptPages,
        selectedCompanyLogoUrl:
          preparedAssetUrlMap[exportArtifacts.selectedCompanyLogoUrl] ??
          exportArtifacts.selectedCompanyLogoUrl,
        selectedCompanyName: exportArtifacts.selectedCompanyName,
        totalAmount: exportArtifacts.totalAmount,
      });
      const deliveryResult = deliverExportDownload(exportBlob, exportFileName);

      if (deliveryResult.kind === "cancelled") {
        return;
      }

      setLastPrintedAt(exportedAt);
      setExportFeedbackMessage(deliveryResult.message);
    } catch (error) {
      setPrintError(getFriendlyEditorError(error, "print"));
    } finally {
      setIsPreparingPrint(false);
      setIsSavingPdf(false);
    }
  };

  const handleConfirmExport = async () => {
    if (isPreparingPrint || isSavingPdf) {
      return;
    }

    setPrintError(null);
    setExportFeedbackMessage(null);
    setIsSavingPdf(true);

    try {
      const resolvedExpenseCode = await ensureDocumentPersistedForExport();
      const exportArtifacts = buildExportArtifacts(resolvedExpenseCode);
      const exportFileName = buildExportFileName(
        exportArtifacts.displayExpenseReference,
        expenseDate,
      );
      const exportedAt = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());
      const preparedAssetUrlMap =
        Object.keys(exportAssetUrlMap).length > 0
          ? exportAssetUrlMap
          : await prepareExportAssets(exportArtifacts.printableAssetUrls);
      const exportBlob = await createExportPdfBlob({
        assetUrlMap: preparedAssetUrlMap,
        companyAddress: exportArtifacts.companyAddress,
        companyTaxId: exportArtifacts.companyTaxId,
        department: exportArtifacts.department,
        displayExpenseReference: exportArtifacts.displayExpenseReference,
        employeeName: exportArtifacts.printableEmployeeName,
        expenseDate,
        exportCopy: exportArtifacts.exportCopy,
        exportLanguage: exportArtifacts.exportLanguage,
        note: exportArtifacts.note,
        printableFormPages: exportArtifacts.printableFormPages,
        receiptPages: exportArtifacts.receiptPages,
        selectedCompanyLogoUrl:
          preparedAssetUrlMap[exportArtifacts.selectedCompanyLogoUrl] ??
          exportArtifacts.selectedCompanyLogoUrl,
        selectedCompanyName: exportArtifacts.selectedCompanyName,
        totalAmount: exportArtifacts.totalAmount,
      });
      const deliveryResult = isMobileLayout
        ? deliverExportDownload(exportBlob, exportFileName)
        : await deliverExportPdf({
            blob: exportBlob,
            fileName: exportFileName,
            preferShare: false,
          });

      if (deliveryResult.kind === "cancelled") {
        return;
      }

      setLastPrintedAt(exportedAt);
      setExportFeedbackMessage(deliveryResult.message);
      setIsExportPreviewOpen(false);
    } catch (error) {
      setPrintError(getFriendlyEditorError(error, "print"));
    } finally {
      setIsSavingPdf(false);
    }
  };

  if (isLoadingDocument) {
    return (
      <div className="page-shell min-h-screen overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
          <LoadingExpenseDayState />
        </div>
      </div>
    );
  }

  if (documentError) {
    return (
      <div className="page-shell min-h-screen">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
          <Card className="premium-panel rounded-[2rem] border-border/60 py-0">
            <CardContent className="px-6 py-12 text-center sm:px-10">
              <Badge className="rounded-full px-3 py-1" variant="secondary">
                We hit a snag
              </Badge>
              <div className="mx-auto mt-5 flex size-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/8 text-destructive">
                <CircleAlert className="size-7" />
              </div>
              <p className="mt-5 font-serif text-3xl tracking-tight text-foreground">
                This expense page could not be opened
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                {documentError}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild className="rounded-full px-5" variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
                <Button
                  className="rounded-full px-5"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell min-h-screen overflow-x-hidden pb-[calc(7.75rem+env(safe-area-inset-bottom))] md:pb-0">
      <div className="mx-auto w-full max-w-[1300px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-7">
        <section className="screen-only">
          <header className="-mx-3 overflow-hidden border-b border-border/70 bg-background/60 px-3 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 sm:py-5 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="max-w-full rounded-full px-3 py-1" variant="secondary">
                    Expense day
                  </Badge>
                  <Badge
                    className="max-w-full truncate rounded-full px-3 py-1 font-mono text-xs sm:text-sm"
                    variant="outline"
                  >
                    {displayExpenseReference}
                  </Badge>
                  <Badge className="max-w-full rounded-full px-3 py-1" variant="outline">
                    Autosaves
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-foreground sm:text-5xl">
                    {formatDisplayDate(expenseDate)}
                  </h1>
                  <p className="max-w-full text-sm leading-6 text-muted-foreground sm:max-w-3xl sm:text-base sm:leading-7">
                    Add expense rows, attach receipts, then export the PDF.
                  </p>
                </div>

                <div className="flex max-w-full flex-wrap gap-2 text-sm text-muted-foreground">
                  <span className="rounded-full bg-card/80 px-3 py-1">
                    {populatedRows.length} filled row{populatedRows.length === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1">
                    {totalReceipts} receipt{totalReceipts === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
                <Button
                  asChild
                  className="w-full rounded-full border-border/75 bg-card/75 px-4 shadow-none backdrop-blur-xl hover:bg-card sm:w-auto"
                  size="sm"
                  variant="outline"
                >
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
                <Button
                  className={`w-full rounded-full border-border/75 bg-card/75 px-4 shadow-none backdrop-blur-xl hover:bg-card sm:w-auto ${
                    exportValidationMessage ? "border-destructive/35 bg-destructive/10" : ""
                  }`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormDetailsOpen(true)}
                >
                  <Building2 className="size-4" />
                  <span className="sm:hidden">Details</span>
                  <span className="hidden sm:inline">Form details</span>
                </Button>
                <ThemeSettingsSheet
                  className="w-full justify-center border-border/75 bg-card/75 hover:bg-card sm:w-auto"
                  userEmail={session.userEmail}
                />
                {!isMobileLayout ? (
                  <Button
                    className="w-full rounded-full border-border/75 bg-card/75 px-4 shadow-none backdrop-blur-xl hover:bg-card sm:w-auto"
                    disabled={isExportBusy || !canExport}
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void handlePreviewExport();
                    }}
                  >
                    {isExportBusy ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Printer className="size-4" />
                    )}
                    {isExportBusy
                      ? isSavingPdf
                        ? "Saving PDF..."
                        : "Preparing export..."
                      : "Export PDF"}
                  </Button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mt-5">
            <MobileExpenseWorkflowSummary
              canExport={canExport}
              companyName={selectedCompanyName}
              exportIssue={exportValidationMessage}
              filledRows={populatedRows.length}
              onJumpToExportSetup={() => setIsFormDetailsOpen(true)}
              onJumpToRows={() => jumpToMobileSection("mobile-expense-rows")}
              receiptCount={totalReceipts}
            />
          </div>

          <main
            className="-mx-3 mt-5 scroll-mt-5 border-y border-border/70 bg-card/50 sm:-mx-6 lg:-mx-8"
            id="mobile-expense-rows"
          >
            <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <Badge className="rounded-full px-3 py-1" variant="secondary">
                    Expense rows
                  </Badge>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Line items
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                    Add each expense, amount, note, and receipt photo for this day.
                  </p>
                </div>

                <Button className="rounded-full px-5" type="button" onClick={addRow}>
                  <Plus className="size-4" />
                  Add row
                </Button>
              </div>
            </div>

            <div className="border-t border-border/60 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
              {rows.length === 0 ? (
                <div className="rounded-[1.4rem] border border-dashed border-border/75 bg-background/60 px-5 py-12 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Receipt className="size-6" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold text-foreground">
                    No expense lines yet
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">
                    Add your first line item to record the amount, a short note, and
                    any receipt photos for this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rows.map((row) => {
                    const rowNumber = rowNumberById.get(row.id) ?? row.id;
                    const rowReference = formatExpenseLineReferenceCode(
                      expenseDate,
                      rowNumber,
                      expenseCode,
                    );

                    return (
                      <article
                        className="rounded-[1.15rem] border border-border/70 bg-background/75 p-4 shadow-[0_12px_34px_-32px_rgba(26,57,43,0.26)] sm:rounded-[1.35rem]"
                        key={row.id}
                      >
                          <button
                            className="flex w-full flex-col gap-3 text-left sm:flex-row sm:items-start sm:justify-between"
                            type="button"
                            onClick={() => toggleExpanded(row.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="rounded-full px-3 py-1">
                                  {findExpenseTypeLabel(row.typeId)}
                                </Badge>
                                {row.receipts.length > 0 ? (
                                  <Badge className="rounded-full px-3 py-1" variant="outline">
                                    {row.receipts.length} photo
                                    {row.receipts.length === 1 ? "" : "s"}
                                  </Badge>
                                ) : null}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                <span className="inline-flex rounded-full border border-border/70 bg-card/75 px-3 py-1 font-mono tracking-[0.12em] text-foreground/80">
                                  {rowReference}
                                </span>
                                <span className="inline-flex rounded-full border border-dashed border-border/70 px-3 py-1">
                                  {row.receipts.length > 0
                                    ? "Receipts attached"
                                    : "No receipts yet"}
                                </span>
                              </div>

                              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                Expand to edit amount, remark, and receipt photos.
                              </p>
                            </div>

                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                                {row.isExpanded ? "Hide details" : "Edit details"}
                              </span>
                              <span className="flex size-10 items-center justify-center rounded-2xl border border-border/70 bg-card/80 text-muted-foreground">
                                {row.isExpanded ? (
                                  <ChevronUp className="size-4" />
                                ) : (
                                  <ChevronDown className="size-4" />
                                )}
                              </span>
                            </div>
                          </button>

                          {row.isExpanded ? (
                            <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
                              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_11rem]">
                                <label className="block space-y-2">
                                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Type
                                  </span>
                                  <Select
                                    value={row.typeId}
                                    onValueChange={(value) =>
                                      updateRow(row.id, "typeId", value)
                                    }
                                  >
                                    <SelectTrigger className="h-11 w-full rounded-2xl border-border/70 bg-card/75 px-4">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-border/70 bg-popover/95 backdrop-blur-xl">
                                      {EXPENSE_TYPES.map((expenseType) => (
                                        <SelectItem key={expenseType.id} value={expenseType.id}>
                                          {expenseType.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </label>

                                <label className="block space-y-2">
                                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                    Amount (THB)
                                  </span>
                                  <Input
                                    className="h-11 rounded-2xl border-border/70 bg-card/75 px-4 text-right"
                                    min="0"
                                    placeholder="0.00"
                                    step="0.01"
                                    type="number"
                                    value={row.amount}
                                    onChange={(event) =>
                                      updateRow(row.id, "amount", event.target.value)
                                    }
                                  />
                                </label>
                              </div>

                              <label className="block space-y-2">
                                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                                  Remark
                                </span>
                                <Textarea
                                  className="min-h-24 resize-none overflow-hidden rounded-2xl border-border/70 bg-card/75 px-4 py-3"
                                  data-auto-resize="true"
                                  maxLength={EXPENSE_REMARK_MAX_LENGTH}
                                  onInput={(event) => {
                                    resizeTextareaElement(event.currentTarget);
                                  }}
                                  placeholder="What was this expense for?"
                                  value={row.remark}
                                  onChange={(event) =>
                                    updateRow(
                                      row.id,
                                      "remark",
                                      limitTextLength(
                                        event.target.value,
                                        EXPENSE_REMARK_MAX_LENGTH,
                                      ),
                                    )
                                  }
                                />
                                <span className="block text-right text-xs text-muted-foreground">
                                  {row.remark.length}/{EXPENSE_REMARK_MAX_LENGTH}
                                </span>
                              </label>

                              <div className="rounded-[1.15rem] border border-border/70 bg-card/60 p-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                                  <Button
                                    asChild
                                    className="w-full rounded-full border-border/70 bg-background/70 px-4 shadow-none hover:bg-background/85 sm:w-auto"
                                    size="sm"
                                    variant="outline"
                                  >
                                    <label className="cursor-pointer">
                                      <ImagePlus className="size-4" />
                                      {row.receipts.length > 0
                                        ? "Add more receipt photos"
                                        : "Add receipt photos"}
                                      <input
                                        className="hidden"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(event) => {
                                          void handleReceiptChange(row.id, event.target.files);
                                          event.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </Button>

                                  {row.receipts.length > 0 ? (
                                    <Button
                                      className="w-full rounded-full px-4 sm:w-auto"
                                      size="sm"
                                      type="button"
                                      variant="ghost"
                                      onClick={() => toggleReceiptPreview(row.id)}
                                    >
                                      {row.isReceiptPreviewOpen ? "Hide photos" : "Show photos"} (
                                      {row.receipts.length})
                                    </Button>
                                  ) : null}

                                  <Button
                                    className="w-full rounded-full px-4 text-destructive hover:text-destructive sm:w-auto"
                                    size="sm"
                                    type="button"
                                    variant="ghost"
                                    onClick={() => requestRowRemoval(row.id)}
                                  >
                                    <Trash2 className="size-4" />
                                    Remove row
                                  </Button>
                                </div>

                                <p className="mt-3 text-sm text-muted-foreground">
                                  You can keep more than one photo on the same expense line.
                                </p>
                              </div>

                              {row.receipts.length > 0 && row.isReceiptPreviewOpen ? (
                                <ReceiptPreviewGrid
                                  receipts={row.receipts}
                                  rowReference={rowReference}
                                  onRemoveReceipt={(receipt) =>
                                    requestReceiptRemoval(row.id, receipt)
                                  }
                                />
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      );
                  })}

                  <div className="flex justify-center pt-1">
                    <Button
                      className="rounded-full border-border/70 bg-background/70 px-3 text-xs shadow-none hover:bg-background/85"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      <ChevronUp className="size-3.5" />
                      Go back to top
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </section>

        <MobileExpenseBottomDock
          canExport={canExport}
          exportIssue={exportValidationMessage}
          filledRows={populatedRows.length}
          isExportBusy={isExportBusy}
          isSavingPdf={isSavingPdf}
          needsDetails={Boolean(exportValidationMessage)}
          onAddRow={addRow}
          onOpenDetails={() => setIsFormDetailsOpen(true)}
          onExport={() => {
            void handleDirectMobileExport();
          }}
          totalAmountLabel={formatCurrency(totalAmount)}
        />

        <Dialog open={isFormDetailsOpen} onOpenChange={setIsFormDetailsOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[1.75rem] border-border/60 p-0 sm:max-w-2xl">
            <DialogHeader className="border-b border-border/60 px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full px-3 py-1" variant="secondary">
                  Form details
                </Badge>
                {exportValidationMessage ? (
                  <Badge className="rounded-full border-destructive/30 bg-destructive/10 px-3 py-1 text-destructive">
                    Needs attention
                  </Badge>
                ) : (
                  <Badge className="rounded-full px-3 py-1" variant="outline">
                    Ready
                  </Badge>
                )}
              </div>
              <DialogTitle className="font-serif text-2xl tracking-tight sm:text-3xl">
                Details for this expense form
              </DialogTitle>
              <DialogDescription className="text-sm leading-6">
                Company, employee, language, and note details used in the PDF export.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 px-5 py-5 sm:px-6">
              <section className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/65 p-3">
                  <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-background">
                    {selectedCompanyLogoUrl ? (
                      <Image
                        alt={selectedCompanyName || "Selected company logo"}
                        className="h-full w-full object-contain"
                        height={96}
                        src={selectedCompanyLogoUrl}
                        unoptimized
                        width={96}
                      />
                    ) : (
                      <Building2 className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Company
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {selectedCompanyName || "No company selected"}
                    </p>
                    {selectedCompanyTaxId ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {exportCopy.companyTaxId}: {selectedCompanyTaxId}
                      </p>
                    ) : null}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Company for this form
                  </span>
                  <Select
                    disabled={companies.length === 0 && !selectedCompanyId}
                    value={selectedCompanyId || EMPTY_COMPANY_VALUE}
                    onValueChange={handleCompanySelect}
                  >
                    <SelectTrigger className="h-11 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border-white/10 bg-background/75 px-4 text-left">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-white/10 bg-popover/95 backdrop-blur-xl">
                      <SelectItem value={EMPTY_COMPANY_VALUE}>No company selected</SelectItem>
                      {selectedCompanyId && !selectedCompany ? (
                        <SelectItem value={selectedCompanyId}>
                          {selectedCompanyName || "Saved company (unavailable)"}
                        </SelectItem>
                      ) : null}
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                {exportValidationMessage ? (
                  <p className="text-sm leading-6 text-destructive">
                    {exportValidationMessage}
                  </p>
                ) : null}

                {companies.length === 0 && !selectedCompanyId && !hasStoredCompanySnapshot ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-3 text-sm text-muted-foreground">
                    Add a company in Company details before exporting.
                  </div>
                ) : null}
              </section>

              <section className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Employee name</span>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-background/75 px-4"
                    maxLength={EMPLOYEE_NAME_MAX_LENGTH}
                    placeholder="Who is submitting this form?"
                    type="text"
                    value={employeeName}
                    onChange={(event) => {
                      setPrintError(null);
                      setEmployeeName(
                        limitTextLength(event.target.value, EMPLOYEE_NAME_MAX_LENGTH),
                      );
                    }}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Department for this form
                  </span>
                  <Input
                    className="h-11 rounded-2xl border-white/10 bg-background/75 px-4"
                    maxLength={DEPARTMENT_MAX_LENGTH}
                    placeholder="Department name"
                    type="text"
                    value={department}
                    onChange={(event) => {
                      setPrintError(null);
                      setDepartment(limitTextLength(event.target.value, DEPARTMENT_MAX_LENGTH));
                    }}
                  />
                </label>
                <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">
                  These values are saved for this expense form only.
                </p>
              </section>

              <section className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Export language</span>
                  <Select
                    value={exportLanguage}
                    onValueChange={(value) => {
                      setPrintError(null);
                      setExportLanguage(value === "th" ? "th" : "en");
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-white/10 bg-background/75 px-4">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-white/10 bg-popover/95 backdrop-blur-xl">
                      <SelectItem value="en">English export</SelectItem>
                      <SelectItem value="th">Thai export</SelectItem>
                    </SelectContent>
                  </Select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Note</span>
                  <Textarea
                    className="min-h-24 resize-none overflow-hidden rounded-2xl border-white/10 bg-background/75 px-4 py-3"
                    data-auto-resize="true"
                    maxLength={EXPORT_NOTE_MAX_LENGTH}
                    onInput={(event) => {
                      resizeTextareaElement(event.currentTarget);
                    }}
                    placeholder="Optional note"
                    value={note}
                    onChange={(event) => {
                      setPrintError(null);
                      setNote(limitTextLength(event.target.value, EXPORT_NOTE_MAX_LENGTH));
                    }}
                  />
                </label>
              </section>

              <section className="grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2">
                <div className={`rounded-2xl border p-3 ${editorStatus.tone}`}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5">{editorStatus.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {canExport ? "Ready to export" : editorStatus.label}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-foreground/80">
                        {canExport
                          ? `${populatedRows.length} filled row${
                              populatedRows.length === 1 ? "" : "s"
                            }, ${totalReceipts} receipt${
                              totalReceipts === 1 ? "" : "s"
                            } attached.`
                          : editorStatus.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/65 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Export status
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {isPreparingPrint
                      ? "Preparing receipt photos..."
                      : isSavingPdf
                        ? "Sending PDF..."
                        : lastPrintedAt
                          ? `Last exported ${lastPrintedAt}`
                          : "No PDF exported yet"}
                  </p>
                  {printError ? (
                    <p className="mt-2 text-sm leading-6 text-destructive">{printError}</p>
                  ) : exportFeedbackMessage ? (
                    <p className="mt-2 text-sm leading-6 text-primary">
                      {exportFeedbackMessage}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <DialogFooter className="border-t border-border/60 bg-background/80 px-5 py-4 sm:px-6">
              <Button
                className="w-full rounded-full sm:w-auto"
                type="button"
                onClick={() => setIsFormDetailsOpen(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!isMobileLayout && isExportPreviewOpen}
          onOpenChange={(open) => {
            if (isSavingPdf) {
              return;
            }

            setIsExportPreviewOpen(open);
          }}
        >
          <DialogContent
            className="flex h-[100dvh] w-screen max-w-screen flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[calc(100vh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:rounded-[2rem] sm:border sm:border-border/60 2xl:max-w-[1600px]"
            onInteractOutside={(event) => event.preventDefault()}
            showCloseButton={!isSavingPdf}
          >
            <DialogHeader className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] px-3 py-3 sm:px-6 sm:py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <DialogTitle className="pr-10 font-serif text-[1.75rem] tracking-tight sm:pr-0 sm:text-3xl lg:text-4xl">
                    Export preview
                  </DialogTitle>
                  <DialogDescription className="mt-2 max-w-2xl text-sm leading-6 sm:leading-7">
                    {isMobileLayout
                      ? "Mobile export skips preview and starts the PDF download directly."
                      : "Review the full PDF before saving. This preview is scrollable through every expense and receipt page."}
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Badge className="rounded-full px-3 py-1" variant="secondary">
                    {exportPreviewPages.length} page
                    {exportPreviewPages.length === 1 ? "" : "s"}
                  </Badge>
                  <Badge className="rounded-full px-3 py-1" variant="outline">
                    {displayExpenseReference}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="border-b border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground sm:px-6 sm:py-3 sm:text-sm">
              {isMobileLayout
                ? "Mobile browsers download the PDF directly without rendering this preview."
                : "Confirm to open your system save prompt and write the PDF directly from this preview."}
            </div>

            <div
              className="export-preview-shell flex-1 overflow-auto bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.08),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_36%)] px-2 py-2 sm:px-4 sm:py-4 lg:px-6"
              ref={exportPreviewViewportRef}
            >
              <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 sm:gap-6">
                {exportPreviewPages.map((page) =>
                  isMobileExportPreview ? (
                    <MobileExportPreviewPageCard
                      key={page.key}
                      label={page.label}
                      scale={exportPreviewScale}
                    >
                      {page.node}
                    </MobileExportPreviewPageCard>
                  ) : (
                    <DesktopExportPreviewPageCard key={page.key} scale={exportPreviewScale}>
                      {page.node}
                    </DesktopExportPreviewPageCard>
                  ),
                )}
              </div>
            </div>

            <DialogFooter className="border-t border-border/60 bg-background/80 px-3 py-3 sm:px-6 sm:py-4">
              {printError ? (
                <p className="mr-auto max-w-md text-sm leading-6 text-destructive">
                  {printError}
                </p>
              ) : exportFeedbackMessage ? (
                <p className="mr-auto text-sm text-primary">{exportFeedbackMessage}</p>
              ) : (
                <p className="mr-auto text-sm text-muted-foreground">
                  {isMobileLayout
                    ? "The PDF will download directly on mobile."
                    : "The saved PDF matches this preview layout."}
                </p>
              )}
              <Button
                className="w-full rounded-full sm:w-auto"
                disabled={isSavingPdf}
                type="button"
                variant="outline"
                onClick={() => setIsExportPreviewOpen(false)}
              >
                Close
              </Button>
              <Button
                className="w-full rounded-full px-5 sm:w-auto"
                disabled={isSavingPdf}
                type="button"
                onClick={() => {
                  void handleConfirmExport();
                }}
              >
                {isSavingPdf ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {isSavingPdf
                  ? isMobileLayout
                    ? "Downloading PDF..."
                    : "Saving PDF..."
                  : isMobileLayout
                    ? "Download PDF"
                    : "Confirm and save PDF"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isPreparingPrint ? (
          <div className="screen-only fixed inset-0 z-40 flex items-center justify-center bg-background/75 px-4 backdrop-blur-md">
            <div className="premium-panel w-full max-w-md rounded-[2rem] border border-border/60 px-6 py-7 text-center shadow-2xl">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                <LoaderCircle className="size-7 animate-spin" />
              </div>
              <p className="mt-5 font-serif text-3xl tracking-tight text-foreground">
                Preparing your export
              </p>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                We&apos;re loading the receipt photos first so they appear properly in the
                exported file.
              </p>
              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="size-2 rounded-full bg-primary/90 animate-[pulse_1.4s_ease-in-out_infinite]" />
                <span
                  className="size-2 rounded-full bg-primary/65 animate-[pulse_1.4s_ease-in-out_180ms_infinite]"
                />
                <span
                  className="size-2 rounded-full bg-primary/45 animate-[pulse_1.4s_ease-in-out_360ms_infinite]"
                />
              </div>
            </div>
          </div>
        ) : null}

        <AlertDialog
          open={pendingRemoval !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingRemoval(null);
            }
          }}
        >
          <AlertDialogContent className="rounded-[1.75rem] border-border/60 p-6">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingRemoval?.kind === "receipt"
                  ? "Remove this receipt photo?"
                  : "Remove this expense row?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="leading-7">
                {pendingRemoval?.kind === "receipt"
                  ? `This will remove "${pendingRemoval.receiptName}" from ${pendingRemoval.rowReference}.`
                  : pendingRemoval
                    ? `This will remove ${pendingRemoval.rowReference} and all of its receipt photos.`
                    : "This action cannot be undone on this page."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full">Keep it</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full"
                variant="destructive"
                onClick={confirmPendingRemoval}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PrintExpenseFormPage({
  companyAddress,
  companyTaxId,
  currentPage,
  department,
  displayExpenseReference,
  employeeName,
  expenseDate,
  exportCopy,
  exportLanguage,
  note,
  rows,
  selectedCompanyLogoUrl,
  selectedCompanyName,
  showFooter,
  totalAmount,
  totalPages,
}: {
  companyAddress: string;
  companyTaxId: string;
  currentPage: number;
  department: string;
  displayExpenseReference: string;
  employeeName: string;
  expenseDate: string;
  exportCopy: ExportCopy;
  exportLanguage: ExportLanguage;
  note: string;
  rows: PrintableFormRow[];
  selectedCompanyLogoUrl: string;
  selectedCompanyName: string;
  showFooter: boolean;
  totalAmount: number;
  totalPages: number;
}) {
  const trimmedCompanyAddress = companyAddress.trim();
  const hasCompanyAddress = Boolean(trimmedCompanyAddress);
  const companyNameText = selectedCompanyName || exportCopy.companyPending;
  const shouldStackAddressHeader = shouldStackCompanyAddressHeader(
    companyNameText,
    trimmedCompanyAddress,
  );
  const headerAddressWidth = getCompanyAddressHeaderWidth(trimmedCompanyAddress);
  const headerSideWidth =
    hasCompanyAddress && !shouldStackAddressHeader
      ? headerAddressWidth
      : totalPages > 1
        ? 144
        : 0;

  return (
    <section
      className="export-sheet print-card rounded-none bg-white text-black"
      data-export-page
    >
      <div className="flex h-full flex-col p-0">
        <div className="flex items-start gap-3 border-b border-black/25 pb-2.5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[0.85rem]">
            {selectedCompanyLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- eager loading keeps the logo available during PDF export.
              <img
                alt={selectedCompanyName || exportCopy.companyPending}
                className="h-full w-full object-contain"
                crossOrigin="anonymous"
                decoding="sync"
                loading="eager"
                src={selectedCompanyLogoUrl}
              />
            ) : (
              <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-black/45">
                Logo
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div
                className="min-w-0"
                style={
                  headerSideWidth
                    ? { maxWidth: `calc(100% - ${headerSideWidth + 12}px)` }
                    : undefined
                }
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/55">
                  {exportCopy.companyCaption}
                </p>
                <h2 className="mt-1 font-serif text-[1.02rem] leading-[1.15] [overflow-wrap:anywhere]">
                  {companyNameText}
                </h2>
                {companyTaxId ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-black/60 [overflow-wrap:anywhere]">
                    {exportCopy.companyTaxId}: {companyTaxId}
                  </p>
                ) : null}
                {exportCopy.formSubtitle ? (
                  <p className="mt-0.5 text-[11px] text-black/65">{exportCopy.formSubtitle}</p>
                ) : null}
                <p className={exportCopy.formSubtitle ? "mt-1 text-[13px] font-semibold" : "mt-2 text-[13px] font-semibold"}>
                  {exportCopy.formTitle}
                </p>
              </div>

              {hasCompanyAddress || totalPages > 1 ? (
                <div className="shrink-0 text-right" style={{ width: headerSideWidth }}>
                  {totalPages > 1 ? (
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/55">
                      {formatFormPageCounter(currentPage, totalPages, exportLanguage)}
                    </p>
                  ) : null}
                  {hasCompanyAddress && !shouldStackAddressHeader ? (
                    <p
                      className={`whitespace-pre-line break-words text-[10px] leading-[1.1rem] text-black/65 ${
                        totalPages > 1 ? "mt-2" : "mt-0.5"
                      }`}
                    >
                      {trimmedCompanyAddress}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {hasCompanyAddress && shouldStackAddressHeader ? (
              <p className="mt-2 whitespace-pre-line break-words text-[9px] leading-[0.9rem] text-black/65">
                {trimmedCompanyAddress}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] gap-x-4 gap-y-2.5 text-sm">
          <InfoLine
            label={exportCopy.date}
            value={formatExportDate(expenseDate, exportLanguage)}
          />
          <InfoLine label={exportCopy.employee} value={employeeName} />
          <InfoLine label={exportCopy.department} value={department || "-"} />
          <InfoLine
            label={exportCopy.reference}
            reserveWritingSpace
            value={BLANK_PRINT_FIELD_VALUE}
          />
        </div>

        <div className="mt-2 border-b border-black/15 pb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/55">
            {exportCopy.note}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-[11px] leading-[1.05rem]">
            {note || exportCopy.noteFallback}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-2.5 px-1 py-2 text-sm text-black/60">{exportCopy.noExpenses}</div>
        ) : (
          <div className="mt-2.5 overflow-hidden border border-black/40">
            <div
              className="grid bg-black/[0.035] text-[8px] font-semibold uppercase tracking-[0.12em] text-black/85"
              style={{ gridTemplateColumns: PRINT_TABLE_GRID_TEMPLATE }}
            >
              <div className="border-r border-b border-black/35 px-2 py-1.5">
                {exportCopy.line}
              </div>
              <div className="border-r border-b border-black/35 px-2 py-1.5">
                {exportCopy.expenseType}
              </div>
              <div className="border-r border-b border-black/35 px-2 py-1.5">
                {exportCopy.expenseNote}
              </div>
              <div className="border-b border-black/35 px-2 py-1.5 text-right">
                {exportCopy.amount}
              </div>
            </div>

            {rows.map(({ lineNumber, row }) => (
              <div
                className="grid text-[10px] text-black"
                key={row.id}
                style={{ gridTemplateColumns: PRINT_TABLE_GRID_TEMPLATE }}
              >
                <div className="border-r border-b border-black/25 px-2 py-1.5 text-[8px] font-semibold leading-[0.92rem] [overflow-wrap:anywhere]">
                  {formatExpenseLineReferenceCode(
                    expenseDate,
                    lineNumber,
                    displayExpenseReference,
                  )}
                </div>
                <div className="border-r border-b border-black/25 px-2 py-1.5">
                  <p className="line-clamp-2 font-medium leading-[1rem]">
                    {formatExportExpenseTypeLabel(row.typeId, exportLanguage)}
                  </p>
                </div>
                <div className="border-r border-b border-black/25 px-2 py-1.5">
                  <p className="whitespace-pre-line break-words leading-[1rem] text-black/78">
                    {row.remark || exportCopy.emptyRemark}
                  </p>
                </div>
                <div className="border-b border-black/25 px-2 py-1.5 text-right font-medium">
                  {row.amount.trim()
                    ? formatPrintAmount(parseAmount(row.amount), exportLanguage)
                    : "-"}
                </div>
              </div>
            ))}
          </div>
        )}

        {showFooter ? (
          <div className="mt-auto pt-5">
            <div className="mt-2 border-t border-black/25 px-0.5 pb-2 pt-2.5 text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-black/55">
                {exportCopy.total}
              </p>
              <p className="mt-2 text-[1.6rem] font-bold leading-none">
                {formatPrintAmount(totalAmount, exportLanguage)}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-[9px]">
              {exportCopy.signatures.map((label) => (
                <div className="text-center" key={label}>
                  <p className="font-semibold tracking-[0.02em]">{exportCopy.signatureHint}</p>
                  <div className="mt-5 border-b border-black/75" />
                  <p className="mt-2 text-black/80">{label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReceiptExportPage({
  assetUrlMap,
  entries,
  exportCopy,
  exportLanguage,
  pageIndex,
  totalPages,
}: {
  assetUrlMap: Record<string, string>;
  entries: PrintableReceiptEntry[];
  exportCopy: ExportCopy;
  exportLanguage: ExportLanguage;
  pageIndex: number;
  totalPages: number;
}) {
  return (
    <section className="export-sheet print-card rounded-none bg-white text-black" data-export-page>
      <div className="p-0">
        <div className="border-b border-black/25 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-black/55">
            {exportCopy.receiptsSheetTitle}
          </p>
          <p className="mt-1.5 text-[12px] text-black/65">
            {formatReceiptPageCounter(pageIndex + 1, totalPages, exportLanguage)}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {entries.map((entry) => {
            const receiptPreviewUrl =
              assetUrlMap[entry.receipt.previewUrl] ?? entry.receipt.previewUrl;

            return (
              <article className="p-0" key={entry.key}>
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-black/55">
                  {entry.label}
                </p>
                <p className="mt-1 line-clamp-1 text-[11px] text-black/65">
                  {formatExportExpenseTypeLabel(entry.row.typeId, exportLanguage)}
                </p>

                <div className="mt-2 flex h-48 items-center justify-center overflow-hidden border border-black/25 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- eager loading avoids missing receipt images in exported PDF output. */}
                  <img
                    alt={entry.label}
                    className="h-full w-full object-contain"
                    crossOrigin="anonymous"
                    decoding="sync"
                    loading="eager"
                    src={receiptPreviewUrl}
                  />
                </div>

                <p className="mt-1.5 line-clamp-1 text-[10px] text-black/60">
                  {entry.receipt.name}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function formatExportDate(value: string, language: ExportLanguage) {
  const parsedDate = new Date(`${value}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "th" ? "th-TH" : "en-GB", {
    dateStyle: "long",
  }).format(parsedDate);
}

function formatExportExpenseTypeLabel(typeId: string, language: ExportLanguage) {
  if (language === "th") {
    return THAI_EXPENSE_TYPE_LABELS[typeId] ?? findExpenseTypeLabel(typeId);
  }

  return findExpenseTypeLabel(typeId);
}

function formatPrintAmount(amount: number, language: ExportLanguage) {
  const numericAmount = Number.isFinite(amount) ? amount : 0;
  const formattedNumber = new Intl.NumberFormat(language === "th" ? "th-TH" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);

  return language === "th" ? `${formattedNumber} บาท` : `${formattedNumber} THB`;
}

function formatFormPageCounter(
  currentPage: number,
  totalPages: number,
  language: ExportLanguage,
) {
  if (language === "th") {
    return `หน้าฟอร์ม ${currentPage} จาก ${totalPages}`;
  }

  return `Form page ${currentPage} of ${totalPages}`;
}

function formatReceiptPageCounter(
  currentPage: number,
  totalPages: number,
  language: ExportLanguage,
) {
  if (language === "th") {
    return `หน้า ${currentPage} จาก ${totalPages}`;
  }

  return `Page ${currentPage} of ${totalPages}`;
}

function chunkEntries<T>(entries: T[], size: number) {
  if (entries.length === 0) {
    return [] as T[][];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }

  return chunks;
}

function LoadingExpenseDayState() {
  return (
    <section className="screen-only">
      <header className="-mx-3 overflow-hidden border-b border-border/70 bg-background/60 px-3 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 sm:py-5 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-52 max-w-[68vw] rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>

            <div className="space-y-3">
              <Skeleton className="h-12 w-64 max-w-full rounded-2xl sm:h-14 sm:w-80" />
              <Skeleton className="h-5 w-[34rem] max-w-full rounded-full" />
            </div>

            <div className="flex max-w-full flex-wrap gap-2">
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:w-auto sm:flex sm:flex-wrap sm:justify-end">
            <Skeleton className="h-10 w-full rounded-full sm:w-44" />
            <Skeleton className="h-10 w-full rounded-full sm:w-36" />
            <Skeleton className="h-10 w-full rounded-full sm:w-32" />
            <Skeleton className="hidden h-10 w-full rounded-full md:block sm:w-32" />
          </div>
        </div>
      </header>

      <div className="mt-5 md:hidden">
        <div className="rounded-[1.2rem] border border-border/70 bg-background/80 p-3 shadow-[0_12px_34px_-30px_rgba(15,23,42,0.52)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-7 w-48 max-w-full rounded-xl" />
            </div>
            <Skeleton className="h-7 w-20 shrink-0 rounded-full" />
          </div>

          <div className="mt-3 grid gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-border/70 bg-card/75 px-3 py-2.5"
                key={index}
              >
                <Skeleton className="size-10 shrink-0 rounded-[0.9rem]" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28 rounded-full" />
                  <Skeleton className="h-3.5 w-full max-w-56 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="-mx-3 mt-5 border-y border-border/70 bg-card/50 sm:-mx-6 lg:-mx-8">
        <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-10 w-48 rounded-2xl" />
              <Skeleton className="h-5 w-[30rem] max-w-full rounded-full" />
            </div>
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>

        <div className="border-t border-border/60 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="rounded-[1.15rem] border border-border/70 bg-background/75 p-4 shadow-[0_12px_34px_-32px_rgba(26,57,43,0.26)] sm:rounded-[1.35rem]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-8 w-32 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-7 w-60 max-w-full rounded-full" />
                  <Skeleton className="h-7 w-36 rounded-full" />
                </div>
                <Skeleton className="h-5 w-[28rem] max-w-full rounded-full" />
              </div>
              <Skeleton className="h-10 w-36 rounded-2xl" />
            </div>
          </div>

          <div className="mt-5 flex justify-center">
            <Skeleton className="h-10 w-36 rounded-full" />
          </div>
        </div>
      </main>
    </section>
  );
}

function InfoLine({
  label,
  reserveWritingSpace,
  value,
}: {
  label: string;
  reserveWritingSpace?: boolean;
  value: string;
}) {
  return (
    <div className="px-0.5 py-0.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/45">
        {label}
      </p>
      <p
        className={`border-b border-black/15 pb-1 text-[13px] leading-5 ${
          reserveWritingSpace
            ? "mt-2 min-h-[2.55rem]"
            : "mt-1 line-clamp-2"
        }`}
      >
        {value || "\u00A0"}
      </p>
    </div>
  );
}

function ReceiptPreviewGrid({
  onRemoveReceipt,
  receipts,
  rowReference,
}: {
  onRemoveReceipt: (receipt: ReceiptDraft) => void;
  receipts: ReceiptDraft[];
  rowReference: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-background/60 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Receipt photos for {rowReference}</p>
          <p className="text-xs text-muted-foreground">
            Remove any photo you no longer want on the export.
          </p>
        </div>
        <Badge className="rounded-full px-3 py-1" variant="outline">
          {receipts.length} photo{receipts.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {receipts.map((receipt) => (
          <div
            className="overflow-hidden rounded-[1.4rem] border border-white/10 bg-background/85"
            key={receipt.id}
          >
            <div className="relative border-b border-white/10 bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- preview cards use raw urls/data urls and should render immediately. */}
              <img
                alt={receipt.name}
                className="h-40 w-full object-cover"
                decoding="async"
                loading="lazy"
                src={receipt.previewUrl}
              />
              <Button
                className="absolute right-3 top-3 rounded-full border-white/15 bg-background/85 shadow-lg backdrop-blur"
                size="icon-xs"
                type="button"
                variant="secondary"
                onClick={() => onRemoveReceipt(receipt)}
              >
                <X className="size-3.5" />
                <span className="sr-only">Remove receipt photo</span>
              </Button>
            </div>

            <div className="p-3">
              <p className="truncate text-sm font-medium text-foreground">{receipt.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{receipt.sizeLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
