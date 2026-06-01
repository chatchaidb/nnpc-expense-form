import { getBangkokDateInputValue } from "@/lib/date";
import { hasRowContent } from "@/lib/expense-data";
import {
  LOCAL_DEVELOPMENT_USER_EMAIL,
  isLocalDevelopmentAccessToken,
  readLocalStorageJson,
} from "@/lib/local-mode";
import type { ExpenseDayDocument } from "@/lib/report-data";
import { supabaseRpcRequest } from "@/lib/supabase-api";

export type AdminExpenseDay = {
  companyName: string;
  date: string;
  employeeName: string;
  expenseCode: string;
  reportId: string;
  totalAmount: number;
};

export type AdminExpenseUserSummary = {
  displayName: string;
  email: string;
  monthDaysWithExpenses: number;
  monthlyExpense: number;
  userId: string;
  yearlyExpense: number;
};

export type AdminExpenseUserDetail = AdminExpenseUserSummary & {
  detailRows: AdminExpenseDay[];
};

export type AdminExpenseDashboard = {
  periodLabel: string;
  selectedMonth: number;
  selectedPeriod: string;
  selectedYear: number;
  totals: {
    monthlyExpense: number;
    usersWithMonthlyExpenses: number;
    yearlyExpense: number;
  };
  users: AdminExpenseUserSummary[];
};

export type AdminExpenseUserDetailResponse = {
  periodLabel: string;
  selectedMonth: number;
  selectedPeriod: string;
  selectedYear: number;
  user: AdminExpenseUserDetail | null;
};

type SummaryUserPayload = {
  displayName?: string;
  email?: string;
  monthDaysWithExpenses?: number | string;
  monthlyExpense?: number | string;
  userId?: string;
  yearlyExpense?: number | string;
};

type AdminExpenseDashboardPayload = {
  selectedMonth?: number | string;
  selectedPeriod?: string;
  selectedYear?: number | string;
  totals?: {
    monthlyExpense?: number | string;
    usersWithMonthlyExpenses?: number | string;
    yearlyExpense?: number | string;
  } | null;
  users?: SummaryUserPayload[] | null;
};

type AdminExpenseUserDetailPayload = {
  selectedMonth?: number | string;
  selectedPeriod?: string;
  selectedYear?: number | string;
  user?: {
    detailRows?: Array<{
      companyName?: string;
      date?: string;
      employeeName?: string;
      expenseCode?: string;
      reportId?: string;
      totalAmount?: number | string;
    }> | null;
    displayName?: string;
    email?: string;
    monthDaysWithExpenses?: number | string;
    monthlyExpense?: number | string;
    userId?: string;
    yearlyExpense?: number | string;
  } | null;
};

const LOCAL_EXPENSE_DAYS_KEY = "nnpc-local-expense-days";

function toNumber(value: number | string | undefined | null) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizeExpenseUserSummary(user: SummaryUserPayload, userIndex = 0) {
  return {
    displayName: user.displayName?.trim() || "Expense owner",
    email: user.email?.trim() || "No email",
    monthDaysWithExpenses: toNumber(user.monthDaysWithExpenses),
    monthlyExpense: toNumber(user.monthlyExpense),
    userId: user.userId?.trim() || `user-${userIndex + 1}`,
    yearlyExpense: toNumber(user.yearlyExpense),
  } satisfies AdminExpenseUserSummary;
}

export function getDefaultAdminPeriod() {
  return getBangkokDateInputValue().slice(0, 7);
}

export function normalizeAdminPeriod(rawPeriod?: string | null) {
  const fallbackPeriod = getDefaultAdminPeriod();

  if (!rawPeriod || !/^\d{4}-\d{2}$/.test(rawPeriod)) {
    return fallbackPeriod;
  }

  const year = Number(rawPeriod.slice(0, 4));
  const month = Number(rawPeriod.slice(5, 7));

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fallbackPeriod;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return fallbackPeriod;
  }

  return rawPeriod;
}

export function formatAdminPeriodLabel(period: string) {
  const normalizedPeriod = normalizeAdminPeriod(period);
  const parsedDate = new Date(`${normalizedPeriod}-01T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedPeriod;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

export async function getAdminExpenseDashboard(accessToken: string, period: string) {
  const normalizedPeriod = normalizeAdminPeriod(period);

  if (isLocalDevelopmentAccessToken(accessToken)) {
    const localDays = Object.values(
      readLocalStorageJson<Record<string, ExpenseDayDocument>>(
        LOCAL_EXPENSE_DAYS_KEY,
        {},
      ),
    );
    const selectedYear = Number(normalizedPeriod.slice(0, 4));
    const monthlyDays = localDays.filter((day) =>
      day.reportId.replace("local-report-", "").startsWith(normalizedPeriod),
    );
    const yearlyDays = localDays.filter((day) =>
      day.reportId.replace("local-report-", "").startsWith(String(selectedYear)),
    );
    const monthlyExpense = monthlyDays.reduce(
      (total, day) =>
        total +
        day.rows
          .filter(hasRowContent)
          .reduce((rowTotal, row) => rowTotal + Number(row.amount || 0), 0),
      0,
    );
    const yearlyExpense = yearlyDays.reduce(
      (total, day) =>
        total +
        day.rows
          .filter(hasRowContent)
          .reduce((rowTotal, row) => rowTotal + Number(row.amount || 0), 0),
      0,
    );

    return {
      periodLabel: formatAdminPeriodLabel(normalizedPeriod),
      selectedMonth: Number(normalizedPeriod.slice(5, 7)),
      selectedPeriod: normalizedPeriod,
      selectedYear,
      totals: {
        monthlyExpense,
        usersWithMonthlyExpenses: monthlyDays.length > 0 ? 1 : 0,
        yearlyExpense,
      },
      users: [
        {
          displayName: "Local reviewer",
          email: LOCAL_DEVELOPMENT_USER_EMAIL,
          monthDaysWithExpenses: monthlyDays.length,
          monthlyExpense,
          userId: "local-reviewer",
          yearlyExpense,
        },
      ],
    } satisfies AdminExpenseDashboard;
  }

  const payload = await supabaseRpcRequest<AdminExpenseDashboardPayload>({
    accessToken,
    args: {
      p_period: normalizedPeriod,
    },
    fn: "get_admin_expense_dashboard",
  });

  const selectedPeriod = normalizeAdminPeriod(payload.selectedPeriod ?? normalizedPeriod);
  const selectedYear = toNumber(payload.selectedYear) || Number(selectedPeriod.slice(0, 4));
  const selectedMonth = toNumber(payload.selectedMonth) || Number(selectedPeriod.slice(5, 7));

  return {
    periodLabel: formatAdminPeriodLabel(selectedPeriod),
    selectedMonth,
    selectedPeriod,
    selectedYear,
    totals: {
      monthlyExpense: toNumber(payload.totals?.monthlyExpense),
      usersWithMonthlyExpenses: toNumber(payload.totals?.usersWithMonthlyExpenses),
      yearlyExpense: toNumber(payload.totals?.yearlyExpense),
    },
    users: (payload.users ?? []).map((user, userIndex) =>
      normalizeExpenseUserSummary(user, userIndex),
    ),
  } satisfies AdminExpenseDashboard;
}

export async function getAdminExpenseUserDetail(
  accessToken: string,
  period: string,
  userId: string,
) {
  const normalizedPeriod = normalizeAdminPeriod(period);

  if (isLocalDevelopmentAccessToken(accessToken)) {
    const selectedYear = Number(normalizedPeriod.slice(0, 4));
    const localDays = Object.values(
      readLocalStorageJson<Record<string, ExpenseDayDocument>>(
        LOCAL_EXPENSE_DAYS_KEY,
        {},
      ),
    );
    const monthlyDays = localDays.filter((day) =>
      day.reportId.replace("local-report-", "").startsWith(normalizedPeriod),
    );
    const yearlyDays = localDays.filter((day) =>
      day.reportId.replace("local-report-", "").startsWith(String(selectedYear)),
    );
    const monthlyExpense = monthlyDays.reduce(
      (total, day) =>
        total +
        day.rows
          .filter(hasRowContent)
          .reduce((rowTotal, row) => rowTotal + Number(row.amount || 0), 0),
      0,
    );
    const yearlyExpense = yearlyDays.reduce(
      (total, day) =>
        total +
        day.rows
          .filter(hasRowContent)
          .reduce((rowTotal, row) => rowTotal + Number(row.amount || 0), 0),
      0,
    );

    return {
      periodLabel: formatAdminPeriodLabel(normalizedPeriod),
      selectedMonth: Number(normalizedPeriod.slice(5, 7)),
      selectedPeriod: normalizedPeriod,
      selectedYear,
      user: {
        detailRows: monthlyDays.map((day) => ({
          companyName: day.companyName || "Local company",
          date: day.reportId.replace("local-report-", ""),
          employeeName: day.employeeName || "Local reviewer",
          expenseCode: day.expenseCode,
          reportId: day.reportId,
          totalAmount: day.rows
            .filter(hasRowContent)
            .reduce((total, row) => total + Number(row.amount || 0), 0),
        })),
        displayName: "Local reviewer",
        email: LOCAL_DEVELOPMENT_USER_EMAIL,
        monthDaysWithExpenses: monthlyDays.length,
        monthlyExpense,
        userId,
        yearlyExpense,
      },
    } satisfies AdminExpenseUserDetailResponse;
  }

  const payload = await supabaseRpcRequest<AdminExpenseUserDetailPayload>({
    accessToken,
    args: {
      p_period: normalizedPeriod,
      p_user_id: userId,
    },
    fn: "get_admin_expense_user_detail",
  });

  const selectedPeriod = normalizeAdminPeriod(payload.selectedPeriod ?? normalizedPeriod);
  const selectedYear = toNumber(payload.selectedYear) || Number(selectedPeriod.slice(0, 4));
  const selectedMonth = toNumber(payload.selectedMonth) || Number(selectedPeriod.slice(5, 7));
  const userPayload = payload.user ?? null;
  const selectedUser = userPayload
    ? {
        ...normalizeExpenseUserSummary(userPayload),
        detailRows: (userPayload.detailRows ?? []).map((detailRow, detailIndex) => ({
          companyName: detailRow.companyName?.trim() || "No company",
          date: detailRow.date?.trim() || "",
          employeeName: detailRow.employeeName?.trim() || "Expense owner",
          expenseCode: detailRow.expenseCode?.trim() || "EXP",
          reportId:
            detailRow.reportId?.trim() ||
            `detail-${userPayload.userId?.trim() || userId}-${detailIndex + 1}`,
          totalAmount: toNumber(detailRow.totalAmount),
        })),
      }
    : null;

  return {
    periodLabel: formatAdminPeriodLabel(selectedPeriod),
    selectedMonth,
    selectedPeriod,
    selectedYear,
    user: selectedUser,
  } satisfies AdminExpenseUserDetailResponse;
}
