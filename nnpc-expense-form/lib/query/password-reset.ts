import "server-only";

import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import { ensureUserAccount, type PasswordResetStatus } from "@/lib/query/accounts";

export type PasswordResetState = {
  approvedAt: string | null;
  requestedAt: string | null;
  status: PasswordResetStatus;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function formatDate(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizePasswordResetStatus(rawStatus?: string | null): PasswordResetStatus {
  if (rawStatus === "approved" || rawStatus === "pending") return rawStatus;
  return "none";
}

function validatePassword(password: string, confirmPassword?: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (password.length > 128) {
    throw new Error("Password must be 128 characters or fewer.");
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new Error("Password confirmation does not match.");
  }
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const user = await prisma.authUser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return {
      approvedAt: null,
      requestedAt: new Date().toISOString(),
      status: "pending",
    } satisfies PasswordResetState;
  }

  await ensureUserAccount({
    email: user.email,
    name: user.name,
    userId: user.id,
  });

  const account = await prisma.userAccount.update({
    data: {
      passwordResetApprovedAt: null,
      passwordResetApprovedById: null,
      passwordResetRequestedAt: new Date(),
      passwordResetStatus: "pending",
    },
    where: { userId: user.id },
  });

  return {
    approvedAt: formatDate(account.passwordResetApprovedAt),
    requestedAt: formatDate(account.passwordResetRequestedAt),
    status: normalizePasswordResetStatus(account.passwordResetStatus),
  } satisfies PasswordResetState;
}

export async function getPasswordResetStatus(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const user = await prisma.authUser.findUnique({
    include: { userAccount: true },
    where: { email: normalizedEmail },
  });

  const account = user?.userAccount;

  return {
    approvedAt: formatDate(account?.passwordResetApprovedAt),
    requestedAt: formatDate(account?.passwordResetRequestedAt),
    status: normalizePasswordResetStatus(account?.passwordResetStatus),
  } satisfies PasswordResetState;
}

export async function completePasswordReset({
  confirmPassword,
  email,
  password,
}: {
  confirmPassword: string;
  email: string;
  password: string;
}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  validatePassword(password, confirmPassword);

  const user = await prisma.authUser.findUnique({
    include: { userAccount: true },
    where: { email: normalizedEmail },
  });

  if (!user?.userAccount || user.userAccount.passwordResetStatus !== "approved") {
    throw new Error("Password reset is not approved yet.");
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction(async (tx) => {
    const credentialAccount = await tx.authAccount.findFirst({
      where: {
        providerId: "credential",
        userId: user.id,
      },
    });

    if (credentialAccount) {
      await tx.authAccount.update({
        data: {
          password: passwordHash,
        },
        where: { id: credentialAccount.id },
      });
    } else {
      await tx.authAccount.create({
        data: {
          accountId: user.id,
          password: passwordHash,
          providerId: "credential",
          userId: user.id,
        },
      });
    }

    await tx.authSession.deleteMany({
      where: { userId: user.id },
    });

    await tx.userAccount.update({
      data: {
        passwordResetApprovedAt: null,
        passwordResetApprovedById: null,
        passwordResetRequestedAt: null,
        passwordResetStatus: "none",
      },
      where: { userId: user.id },
    });
  });

  return {
    approvedAt: null,
    requestedAt: null,
    status: "none",
  } satisfies PasswordResetState;
}
