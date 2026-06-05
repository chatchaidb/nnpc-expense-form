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
  needsDetails: boolean;
  onAddRow: () => void;
  onExport: () => void;
  onOpenDetails: () => void;
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
      <div className="max-w-full overflow-hidden rounded-[1.2rem] border border-border/70 bg-background/80 p-3 shadow-[0_12px_34px_-30px_rgba(15,23,42,0.52)] backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Today&apos;s form
            </p>
            <h2 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-foreground">
              Check before export
            </h2>
          </div>
          <Badge
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px]",
              canExport
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            )}
            variant="outline"
          >
            {canExport ? "Ready" : "Needs setup"}
          </Badge>
        </div>

        <div className="mt-3 grid gap-2">
          <MobileWorkflowStep
            description={companyName || exportIssue || "Select the company header"}
            icon={<Building2 className="size-4" />}
            isReady={Boolean(companyName) && !exportIssue}
            label="Form details"
            onClick={onJumpToExportSetup}
          />
          <MobileWorkflowStep
            description={`${filledRows} filled line${filledRows === 1 ? "" : "s"}`}
            icon={<FileText className="size-4" />}
            isReady={filledRows > 0}
            label="Expense lines"
            onClick={onJumpToRows}
          />
          <MobileWorkflowStep
            description={`${receiptCount} receipt photo${receiptCount === 1 ? "" : "s"}`}
            icon={<Receipt className="size-4" />}
            isReady={receiptCount > 0}
            label="Receipt photos"
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
      className="flex min-h-14 w-full max-w-full items-center gap-2.5 overflow-hidden rounded-2xl border border-border/70 bg-card/75 px-3 py-2.5 text-left transition active:scale-[0.99]"
      type="button"
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[0.9rem]",
          isReady ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-5 text-foreground">
          {label}
        </span>
        <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
          {description}
        </span>
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
  needsDetails,
  onAddRow,
  onExport,
  onOpenDetails,
  totalAmountLabel,
}: MobileExpenseBottomDockProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 md:hidden">
      <div className="border-t border-border/75 bg-background/90 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-18px_48px_-34px_rgba(0,0,0,0.58)] backdrop-blur-2xl">
        <div className="mx-auto max-w-md">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Total
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {totalAmountLabel}
              </p>
            </div>
            <Badge className="shrink-0 rounded-full px-2.5 py-1 text-[11px]" variant="outline">
              {filledRows} row{filledRows === 1 ? "" : "s"}
            </Badge>
          </div>
          {exportIssue ? (
            <p className="mb-2 line-clamp-2 px-1 text-xs leading-5 text-destructive">
              {exportIssue}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2">
            <Button
              className="h-12 rounded-2xl border-border/75 bg-card/75 px-2 text-[13px]"
              type="button"
              variant="outline"
              onClick={onAddRow}
            >
              <Plus className="size-4" />
              Add
            </Button>
            <Button
              className={cn(
                "h-12 rounded-2xl border-border/75 bg-card/75 px-2 text-[13px]",
                needsDetails ? "border-destructive/35 bg-destructive/10 text-destructive" : "",
              )}
              type="button"
              variant="outline"
              onClick={onOpenDetails}
            >
              <Building2 className="size-4" />
              Details
            </Button>
            <Button
              className="h-12 rounded-2xl px-2 text-[13px]"
              disabled={isExportBusy || !canExport}
              type="button"
              onClick={onExport}
            >
              {isExportBusy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {isExportBusy ? (isSavingPdf ? "Saving" : "Preparing") : "Export"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
