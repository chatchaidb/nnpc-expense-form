import "server-only";

import { getBangkokDateInputValue } from "@/lib/date";
import { prisma } from "@/lib/prisma";

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
  if (!rawPeriod || !/^\d{4}-\d{2}$/.test(rawPeriod)) return fallbackPeriod;

  const year = Number(rawPeriod.slice(0, 4));
  const month = Number(rawPeriod.slice(5, 7));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fallbackPeriod;
  if (!Number.isInteger(month) || month < 1 || month > 12) return fallbackPeriod;
  return rawPeriod;
}

export function formatAdminPeriodLabel(period: string) {
  const normalizedPeriod = normalizeAdminPeriod(period);
  const parsedDate = new Date(`${normalizedPeriod}-01T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return normalizedPeriod;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parsedDate);
}

function periodStart(period: string) {
  return new Date(`${period}-01T00:00:00.000Z`);
}

function nextMonth(period: string) {
  const date = periodStart(period);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date;
}

function yearStart(year: number) {
  return new Date(`${year}-01-01T00:00:00.000Z`);
}

function nextYear(year: number) {
  return new Date(`${year + 1}-01-01T00:00:00.000Z`);
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getAdminExpenseDashboard(period: string) {
  const selectedPeriod = normalizeAdminPeriod(period);
  const selectedYear = Number(selectedPeriod.slice(0, 4));
  const selectedMonth = Number(selectedPeriod.slice(5, 7));
  const [monthReports, yearReports, users] = await Promise.all([
    prisma.expenseReport.findMany({
      where: {
        expenseDate: { gte: periodStart(selectedPeriod), lt: nextMonth(selectedPeriod) },
      },
    }),
    prisma.expenseReport.findMany({
      where: {
        expenseDate: { gte: yearStart(selectedYear), lt: nextYear(selectedYear) },
      },
    }),
    prisma.userAccount.findMany(),
  ]);
  const userSummaries = users.map((user) => {
    const userMonthReports = monthReports.filter((report) => report.userId === user.userId);
    const userYearReports = yearReports.filter((report) => report.userId === user.userId);

    return {
      displayName: user.displayName,
      email: user.email ?? "",
      monthDaysWithExpenses: userMonthReports.length,
      monthlyExpense: userMonthReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
      userId: user.userId,
      yearlyExpense: userYearReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
    } satisfies AdminExpenseUserSummary;
  });

  return {
    periodLabel: formatAdminPeriodLabel(selectedPeriod),
    selectedMonth,
    selectedPeriod,
    selectedYear,
    totals: {
      monthlyExpense: monthReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
      usersWithMonthlyExpenses: userSummaries.filter((user) => user.monthDaysWithExpenses > 0).length,
      yearlyExpense: yearReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
    },
    users: userSummaries,
  } satisfies AdminExpenseDashboard;
}

export async function getAdminExpenseUserDetail(period: string, userId: string) {
  const selectedPeriod = normalizeAdminPeriod(period);
  const selectedYear = Number(selectedPeriod.slice(0, 4));
  const selectedMonth = Number(selectedPeriod.slice(5, 7));
  const [user, monthReports, yearReports] = await Promise.all([
    prisma.userAccount.findUnique({ where: { userId } }),
    prisma.expenseReport.findMany({
      orderBy: { expenseDate: "desc" },
      where: {
        expenseDate: { gte: periodStart(selectedPeriod), lt: nextMonth(selectedPeriod) },
        userId,
      },
    }),
    prisma.expenseReport.findMany({
      where: {
        expenseDate: { gte: yearStart(selectedYear), lt: nextYear(selectedYear) },
        userId,
      },
    }),
  ]);

  return {
    periodLabel: formatAdminPeriodLabel(selectedPeriod),
    selectedMonth,
    selectedPeriod,
    selectedYear,
    user: user
      ? {
          detailRows: monthReports.map((report) => ({
            companyName: report.companyName ?? "No company",
            date: dateInputValue(report.expenseDate),
            employeeName: report.employeeName ?? "Expense owner",
            expenseCode: report.expenseCode,
            reportId: report.id,
            totalAmount: Number(report.totalAmountThb),
          })),
          displayName: user.displayName,
          email: user.email ?? "",
          monthDaysWithExpenses: monthReports.length,
          monthlyExpense: monthReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
          userId,
          yearlyExpense: yearReports.reduce((total, report) => total + Number(report.totalAmountThb), 0),
        }
      : null,
  } satisfies AdminExpenseUserDetailResponse;
}
