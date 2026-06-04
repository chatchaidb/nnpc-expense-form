import { apiRequest } from "@/lib/api-client";
import { getBangkokDateInputValue } from "@/lib/date";

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

export async function getAdminExpenseDashboard(_accessToken: string, period: string) {
  const selectedPeriod = normalizeAdminPeriod(period);

  return apiRequest<AdminExpenseDashboard>(
    `/api/admin/expenses?period=${encodeURIComponent(selectedPeriod)}`,
  );
}

export async function getAdminExpenseUserDetail(
  _accessToken: string,
  period: string,
  userId: string,
) {
  const selectedPeriod = normalizeAdminPeriod(period);

  return apiRequest<AdminExpenseUserDetailResponse>(
    `/api/admin/expenses/${encodeURIComponent(userId)}?period=${encodeURIComponent(selectedPeriod)}`,
  );
}
