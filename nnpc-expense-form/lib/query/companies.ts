import "server-only";

import { prisma } from "@/lib/prisma";

export type CompanyRecord = {
  id: string;
  companyAddress: string;
  companyName: string;
  companyTaxId: string;
  logoUrl: string;
  logoBucketName: string | null;
  logoObjectPath: string | null;
  originalLogoFileName: string | null;
  createdAt: string;
};

function normalizeCompany(company: {
  companyAddress: string | null;
  companyName: string;
  companyTaxId: string | null;
  createdAt: Date;
  id: string;
  logoBucketName: string | null;
  logoDataUrl: string | null;
  logoObjectPath: string | null;
  originalLogoFileName: string | null;
}) {
  return {
    companyAddress: company.companyAddress ?? "",
    companyName: company.companyName,
    companyTaxId: company.companyTaxId ?? "",
    createdAt: company.createdAt.toISOString(),
    id: company.id,
    logoBucketName: company.logoBucketName,
    logoObjectPath: company.logoObjectPath,
    logoUrl: company.logoDataUrl ?? "",
    originalLogoFileName: company.originalLogoFileName,
  } satisfies CompanyRecord;
}

export async function listUserCompanies(userId: string) {
  const companies = await prisma.userCompany.findMany({
    orderBy: { createdAt: "desc" },
    where: { userId },
  });
  return companies.map(normalizeCompany);
}

export async function createUserCompany({
  companyAddress,
  companyName,
  companyTaxId,
  logoDataUrl,
  originalLogoFileName,
  userId,
}: {
  companyAddress: string;
  companyName: string;
  companyTaxId: string;
  logoDataUrl: string;
  originalLogoFileName: string;
  userId: string;
}) {
  const company = await prisma.userCompany.create({
    data: {
      companyAddress: companyAddress.trim() || null,
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim() || null,
      logoBucketName: null,
      logoDataUrl,
      logoObjectPath: null,
      originalLogoFileName,
      userId,
    },
  });
  return normalizeCompany(company);
}

export async function updateUserCompany({
  companyAddress,
  companyId,
  companyName,
  companyTaxId,
  logoDataUrl,
  originalLogoFileName,
  userId,
}: {
  companyAddress: string;
  companyId: string;
  companyName: string;
  companyTaxId: string;
  logoDataUrl?: string;
  originalLogoFileName?: string;
  userId: string;
}) {
  const existingCompany = await prisma.userCompany.findFirst({
    where: {
      id: companyId,
      userId,
    },
  });

  if (!existingCompany) {
    throw new Error("Company was not found.");
  }

  const company = await prisma.userCompany.update({
    data: {
      companyAddress: companyAddress.trim() || null,
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim() || null,
      ...(logoDataUrl
        ? {
            logoBucketName: null,
            logoDataUrl,
            logoObjectPath: null,
            originalLogoFileName: originalLogoFileName ?? null,
          }
        : {}),
    },
    where: { id: companyId },
  });
  return normalizeCompany(company);
}
