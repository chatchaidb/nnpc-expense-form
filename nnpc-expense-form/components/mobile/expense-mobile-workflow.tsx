"use client";

import type { ReactNode } from "react";
import {
  Building2,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Plus,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MobileExpenseWorkflowSummaryProps = {
  canExport: boolean;
  companyName: string;
  exportIssue: string | null;
  filledRows: number;
  onJumpToExportSetup: () => void;
  onJumpToRows: () => void;
  receiptCount: number;
};

type MobileExpenseBottomDockProps = {
  canExport: boolean;
  exportIssue: string | null;
  filledRows: number;
  isExportBusy: boolean;
  isSavingPdf: boolean;
  onAddRow: () => void;
  onExport: () => void;
  totalAmountLabel: string;
};

export function MobileExpenseWorkflowSummary({
  canExport,
  companyName,
  exportIssue,
  filledRows,
  onJumpToExportSetup,
  onJumpToRows,
  receiptCount,
}: MobileExpenseWorkflowSummaryProps) {
  return (
    <section className="md:hidden">
      <div className="rounded-[1.25rem] border border-border/70 bg-background/78 p-3 shadow-[0_14px_40px_-34px_rgba(15,23,42,0.7)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Workflow
            </p>
            <h2 className="mt-0.5 truncate font-serif text-xl tracking-tight text-foreground">
              Build, check, export
            </h2>
          </div>
          <Badge
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px]",
              canExport
                ? "border-primary/20 bg-primary/12 text-primary"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            )}
            variant="outline"
          >
            {canExport ? "Ready" : "Needs setup"}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2">
          <MobileWorkflowStep
            description={companyName || exportIssue || "Select a saved company header"}
            icon={<Building2 className="size-4" />}
            isReady={Boolean(companyName) && !exportIssue}
            label="Company"
            onClick={onJumpToExportSetup}
          />
          <MobileWorkflowStep
            description={`${filledRows} filled line${filledRows === 1 ? "" : "s"} ready`}
            icon={<FileText className="size-4" />}
            isReady={filledRows > 0}
            label="Expenses"
            onClick={onJumpToRows}
          />
          <MobileWorkflowStep
            description={`${receiptCount} receipt photo${receiptCount === 1 ? "" : "s"} attached`}
            icon={<Receipt className="size-4" />}
            isReady={receiptCount > 0}
            label="Receipts"
            onClick={onJumpToRows}
          />
        </div>
      </div>
    </section>
  );
}

function MobileWorkflowStep({
  description,
  icon,
  isReady,
  label,
  onClick,
}: {
  description: string;
  icon: ReactNode;
  isReady: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-[1rem] border border-white/10 bg-background/70 px-3 py-2.5 text-left transition active:scale-[0.99]"
      type="button"
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-[0.9rem]",
          isReady ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-5 text-foreground">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      {isReady ? (
        <CheckCircle2 className="size-4 shrink-0 text-primary" />
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-muted-foreground/45" />
      )}
    </button>
  );
}

export function MobileExpenseBottomDock({
  canExport,
  exportIssue,
  filledRows,
  isExportBusy,
  isSavingPdf,
  onAddRow,
  onExport,
  totalAmountLabel,
}: MobileExpenseBottomDockProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="border-t border-border/70 bg-background/88 px-3 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-18px_48px_-32px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <div className="mx-auto max-w-md">
          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Export total
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {totalAmountLabel}
              </p>
            </div>
            <Badge className="shrink-0 rounded-full px-2.5 py-1 text-[11px]" variant="outline">
              Rows {filledRows}
            </Badge>
          </div>
          {exportIssue ? (
            <p className="mb-2 line-clamp-2 px-1 text-xs leading-5 text-destructive">
              {exportIssue}
            </p>
          ) : null}
          <div className="grid grid-cols-[0.76fr_1.24fr] gap-2">
            <Button
              className="h-11 rounded-2xl border-white/10 bg-background/75 px-3"
              type="button"
              variant="outline"
              onClick={onAddRow}
            >
              <Plus className="size-4" />
              Add
            </Button>
            <Button
              className="h-11 rounded-2xl px-3"
              disabled={isExportBusy || !canExport}
              type="button"
              onClick={onExport}
            >
              {isExportBusy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isExportBusy
                ? isSavingPdf
                  ? "Downloading"
                  : "Preparing"
                : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
