import "server-only";

import { prisma } from "@/lib/prisma";

export type AccessStatus = "approved" | "disabled" | "pending";
export type AccountRole = "admin" | "central_admin" | "user";
export type AssignableRole = "admin" | "user";

export type UserAccount = {
  accessStatus: AccessStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  disabledAt: string | null;
  disabledBy: string | null;
  displayName: string;
  email: string;
  role: AccountRole;
  updatedAt: string;
  userId: string;
};

export type AdminUserManagementData = {
  totals: {
    approvedUsers: number;
    disabledUsers: number;
    elevatedUsers: number;
    pendingUsers: number;
  };
  users: UserAccount[];
};

function normalizeAccessStatus(rawStatus?: string | null): AccessStatus {
  if (rawStatus === "approved" || rawStatus === "disabled") return rawStatus;
  return "pending";
}

function normalizeRole(rawRole?: string | null): AccountRole {
  if (rawRole === "admin" || rawRole === "central_admin") return rawRole;
  return "user";
}

function formatDate(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeUserAccount(account: {
  accessStatus: string;
  approvedAt: Date | null;
  approvedById: string | null;
  createdAt: Date;
  disabledAt: Date | null;
  disabledById: string | null;
  displayName: string;
  email: string | null;
  role: string;
  updatedAt: Date;
  userId: string;
}) {
  return {
    accessStatus: normalizeAccessStatus(account.accessStatus),
    approvedAt: formatDate(account.approvedAt),
    approvedBy: account.approvedById,
    createdAt: formatDate(account.createdAt) ?? "",
    disabledAt: formatDate(account.disabledAt),
    disabledBy: account.disabledById,
    displayName: account.displayName,
    email: account.email ?? "",
    role: normalizeRole(account.role),
    updatedAt: formatDate(account.updatedAt) ?? "",
    userId: account.userId,
  } satisfies UserAccount;
}

export async function ensureUserAccount({
  email,
  name,
  userId,
}: {
  email: string;
  name: string;
  userId: string;
}) {
  const existingAccount = await prisma.userAccount.findUnique({
    where: { userId },
  });

  if (existingAccount) {
    return normalizeUserAccount(existingAccount);
  }

  const userCount = await prisma.userAccount.count();
  const account = await prisma.userAccount.create({
    data: {
      accessStatus: userCount === 0 ? "approved" : "pending",
      approvedAt: userCount === 0 ? new Date() : null,
      displayName: name || email,
      email,
      role: userCount === 0 ? "central_admin" : "user",
      userId,
    },
  });

  return normalizeUserAccount(account);
}

export async function getCurrentUserAccount(userId: string) {
  const account = await prisma.userAccount.findUnique({
    where: { userId },
  });

  if (!account) {
    throw new Error("Your account record is not ready yet. Try again in a moment.");
  }

  return normalizeUserAccount(account);
}

export async function getAdminUserManagement() {
  const users = await prisma.userAccount.findMany({
    orderBy: [{ accessStatus: "asc" }, { updatedAt: "desc" }],
  });
  const normalizedUsers = users.map(normalizeUserAccount);

  return {
    totals: {
      approvedUsers: normalizedUsers.filter((user) => user.accessStatus === "approved").length,
      disabledUsers: normalizedUsers.filter((user) => user.accessStatus === "disabled").length,
      elevatedUsers: normalizedUsers.filter(
        (user) => user.role === "admin" || user.role === "central_admin",
      ).length,
      pendingUsers: normalizedUsers.filter((user) => user.accessStatus === "pending").length,
    },
    users: normalizedUsers,
  } satisfies AdminUserManagementData;
}

export async function adminManageUserAccount({
  actorUserId,
  action,
  role,
  targetUserId,
}: {
  actorUserId: string;
  action: "approve" | "delete" | "disable" | "set_role";
  role?: AssignableRole;
  targetUserId: string;
}) {
  if (action === "delete") {
    await prisma.userAccount.delete({ where: { userId: targetUserId } });
    return { action, userId: targetUserId };
  }

  if (action === "approve") {
    await prisma.userAccount.update({
      data: {
        accessStatus: "approved",
        approvedAt: new Date(),
        approvedById: actorUserId,
        disabledAt: null,
        disabledById: null,
        role: role ?? "user",
      },
      where: { userId: targetUserId },
    });
  }

  if (action === "disable") {
    await prisma.userAccount.update({
      data: {
        accessStatus: "disabled",
        disabledAt: new Date(),
        disabledById: actorUserId,
      },
      where: { userId: targetUserId },
    });
  }

  if (action === "set_role") {
    await prisma.userAccount.update({
      data: { role: role ?? "user" },
      where: { userId: targetUserId },
    });
  }

  return { action, userId: targetUserId };
}
