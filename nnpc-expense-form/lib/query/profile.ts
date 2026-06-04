import "server-only";

import { prisma } from "@/lib/prisma";

export type UserProfile = {
  department: string;
  fullName: string;
};

function normalizeProfile(profile: { department: string | null; fullName: string | null } | null) {
  if (!profile) return null;
  return {
    department: profile.department?.trim() || "",
    fullName: profile.fullName?.trim() || "",
  } satisfies UserProfile;
}

export async function getUserProfile(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: userId } });
  return normalizeProfile(profile);
}

export async function upsertUserProfile({
  department,
  fullName,
  userId,
}: {
  department: string;
  fullName: string;
  userId: string;
}) {
  const profile = await prisma.profile.upsert({
    create: {
      department: department.trim() || null,
      fullName: fullName.trim() || null,
      id: userId,
    },
    update: {
      department: department.trim() || null,
      fullName: fullName.trim() || null,
    },
    where: { id: userId },
  });

  return normalizeProfile(profile) ?? { department: "", fullName: "" };
}
