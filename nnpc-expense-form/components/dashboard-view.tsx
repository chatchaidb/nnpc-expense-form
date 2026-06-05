"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import AuthGate, { type AuthSession } from "@/components/auth-gate";
import { ThemeSettingsSheet } from "@/components/theme-settings-sheet";
import { TopRouteTabs } from "@/components/top-route-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { readExpenseSummariesCache, writeExpenseSummariesCache } from "@/lib/browser-cache";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/company-data";
import {
  formatDisplayDate,
  formatExpenseReferenceCode,
  getBangkokDateInputValue,
} from "@/lib/date";
import { formatCurrency, type ExpenseSummary } from "@/lib/expense-data";
import { getFriendlyErrorMessage } from "@/lib/friendly-errors";
import { useI18n } from "@/lib/i18n";
import { listExpenseSummaries } from "@/lib/report-data";
import { type UserAccount } from "@/lib/user-account-data";

export default function DashboardView() {
  return (
    <AuthGate>
      {({ account, session, logout }) => (
        <ProtectedDashboard account={account} logout={logout} session={session} />
      )}
    </AuthGate>
  );
}

function ProtectedDashboard({
  account,
  logout,
  session,
}: {
  account: UserAccount;
  logout: () => Promise<void>;
  session: AuthSession;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const cacheUserKey = session.userEmail;
  const [selectedDate, setSelectedDate] = useState(() => getBangkokDateInputValue());
  const [summaries, setSummaries] = useState<ExpenseSummary[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const matchingSummary = summaries.find((summary) => summary.date === selectedDate);

  useEffect(() => {
    let isActive = true;
    const loadSummaries = async () => {
      const cachedSummaries = readExpenseSummariesCache(cacheUserKey);

      if (cachedSummaries) {
        if (!isActive) {
          return;
        }

        setSummaries(cachedSummaries);
        setSummaryError(null);
        return;
      }

      const nextSummaries = await listExpenseSummaries(session.accessToken);

      if (!isActive) {
        return;
      }

      setSummaries(nextSummaries);
      setSummaryError(null);
      writeExpenseSummariesCache(cacheUserKey, nextSummaries);
    };

    void loadSummaries()
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        if (error instanceof Error && error.message === SESSION_EXPIRED_MESSAGE) {
          void logout();
          return;
        }

        setSummaryError(
          getFriendlyErrorMessage(error, t("dashboard.errorLoadSummaries")),
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingSummaries(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [cacheUserKey, logout, session.accessToken, t]);

  return (
    <div className="page-shell min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-serif text-3xl tracking-tight text-foreground sm:text-4xl">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t("dashboard.description")}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground/80">
              {session.userEmail}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeSettingsSheet userEmail={session.userEmail} />
            <Button
              className="rounded-full border-white/10 bg-background/70 px-4 shadow-none backdrop-blur-xl hover:bg-background/90"
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="size-4" />
              {t("common.logout")}
            </Button>
          </div>
        </header>

        <TopRouteTabs accountRole={account.role} activeSection="expenses" />

        <Card className="mt-6 rounded-[1.5rem] border-border/70 py-0 shadow-none">
          <CardContent className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-foreground">
                  {t("dashboard.expenseDate")}
                </span>
                <Input
                  className="h-11 rounded-2xl bg-background/75 px-4 sm:w-[12rem]"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </label>

              <Button
                className="h-11 rounded-2xl px-5 sm:min-w-[14rem]"
                type="button"
                onClick={() =>
                  router.push(`/expense?date=${encodeURIComponent(selectedDate)}`)
                }
              >
                {matchingSummary
                  ? t("dashboard.openForDate")
                  : t("dashboard.createForDate")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 rounded-[1.5rem] border-border/70 py-0 shadow-none">
          <CardContent className="px-0 py-0">
            <div className="border-b border-border/60 px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold text-foreground">
                {t("dashboard.recentExpenses")}
              </h2>
            </div>

            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-4 border-b border-border/60 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:grid sm:px-5">
              <span>{t("common.date")}</span>
              <span>{t("common.reference")}</span>
              <span>{t("common.total")}</span>
              <span className="sr-only">{t("common.open")}</span>
            </div>

            {summaryError ? (
              <div className="px-4 py-8 text-sm text-destructive sm:px-5">
                {summaryError}
              </div>
            ) : isLoadingSummaries ? (
              <div className="px-4 py-8 text-sm text-muted-foreground sm:px-5">
                {t("dashboard.loadingReports")}
              </div>
            ) : summaries.length === 0 ? (
              <div className="space-y-4 px-4 py-10 sm:px-5">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("dashboard.noSavedDates")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("dashboard.noSavedDatesDescription")}
                  </p>
                </div>
                <Button
                  className="rounded-2xl"
                  type="button"
                  onClick={() =>
                    router.push(`/expense?date=${encodeURIComponent(selectedDate)}`)
                  }
                >
                  {t("dashboard.createForDate")}
                </Button>
              </div>
            ) : (
              <div>
                {summaries.map((summary) => (
                  <Link
                    className="grid gap-3 border-b border-border/50 px-4 py-4 text-sm transition last:border-b-0 hover:bg-accent/45 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4 sm:px-5"
                    href={`/expense?date=${encodeURIComponent(summary.date)}`}
                    key={summary.date}
                  >
                    <span className="min-w-0 font-medium text-foreground">
                      <span className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                        {t("common.date")}
                      </span>
                      <span className="block truncate">{formatDisplayDate(summary.date)}</span>
                    </span>
                    <span className="min-w-0 text-muted-foreground">
                      <span className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                        {t("common.reference")}
                      </span>
                      <span className="block truncate">
                        {formatExpenseReferenceCode(summary.date, summary.expenseCode)}
                      </span>
                    </span>
                    <span className="text-foreground">
                      <span className="block text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground sm:hidden">
                        {t("common.total")}
                      </span>
                      {formatCurrency(summary.totalAmount)}
                    </span>
                    <span className="rounded-full bg-primary/10 px-3 py-1.5 text-center text-xs font-semibold text-foreground">
                      {t("common.open")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
