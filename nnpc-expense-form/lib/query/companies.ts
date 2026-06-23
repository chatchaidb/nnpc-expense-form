import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  createCompanyLogoObjectPath,
  deleteR2Object,
  getPublicObjectUrl,
  getR2BucketName,
  uploadR2Object,
} from "@/lib/r2-storage";

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
    logoUrl: company.logoObjectPath
      ? getPublicObjectUrl(company.logoObjectPath)
      : company.logoDataUrl ?? "",
    originalLogoFileName: company.originalLogoFileName,
  } satisfies CompanyRecord;
}

export async function listUserCompanies(userId: string) {
  void userId;
  const companies = await prisma.userCompany.findMany({
    orderBy: { createdAt: "desc" },
  });
  return companies.map(normalizeCompany);
}

export async function createUserCompany({
  companyAddress,
  companyName,
  companyTaxId,
  logoFile,
  originalLogoFileName,
  userId,
}: {
  companyAddress: string;
  companyName: string;
  companyTaxId: string;
  logoFile: {
    buffer: Buffer;
    mimeType: string;
  };
  originalLogoFileName: string;
  userId: string;
}) {
  const companyId = randomUUID();
  const logoObjectPath = createCompanyLogoObjectPath({
    companyId,
    fileName: originalLogoFileName,
  });

  await uploadR2Object({
    body: logoFile.buffer,
    bucketName: getR2BucketName(),
    contentType: logoFile.mimeType,
    objectPath: logoObjectPath,
  });

  const company = await prisma.userCompany.create({
    data: {
      companyAddress: companyAddress.trim() || null,
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim() || null,
      id: companyId,
      logoBucketName: getR2BucketName(),
      logoDataUrl: null,
      logoObjectPath,
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
  logoFile,
  originalLogoFileName,
}: {
  companyAddress: string;
  companyId: string;
  companyName: string;
  companyTaxId: string;
  logoFile?: {
    buffer: Buffer;
    mimeType: string;
  };
  originalLogoFileName?: string;
}) {
  const existingCompany = await prisma.userCompany.findUnique({ where: { id: companyId } });

  if (!existingCompany) {
    throw new Error("Company was not found.");
  }

  let nextLogoObjectPath: string | null = null;

  if (logoFile) {
    nextLogoObjectPath = createCompanyLogoObjectPath({
      companyId,
      fileName: originalLogoFileName ?? existingCompany.originalLogoFileName ?? "logo",
    });

    await uploadR2Object({
      body: logoFile.buffer,
      bucketName: getR2BucketName(),
      contentType: logoFile.mimeType,
      objectPath: nextLogoObjectPath,
    });
  }

  const company = await prisma.userCompany.update({
    data: {
      companyAddress: companyAddress.trim() || null,
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim() || null,
      ...(logoFile && nextLogoObjectPath
        ? {
            logoBucketName: getR2BucketName(),
            logoDataUrl: null,
            logoObjectPath: nextLogoObjectPath,
            originalLogoFileName: originalLogoFileName ?? null,
          }
        : {}),
    },
    where: { id: companyId },
  });

  if (logoFile && existingCompany.logoObjectPath) {
    await deleteR2Object(existingCompany.logoObjectPath, existingCompany.logoBucketName);
  }

  return normalizeCompany(company);
}

export async function deleteUserCompany(companyId: string) {
  const existingCompany = await prisma.userCompany.findUnique({
    include: { reports: { select: { id: true }, take: 1 } },
    where: { id: companyId },
  });

  if (!existingCompany) {
    throw new Error("Company was not found.");
  }

  if (existingCompany.reports.length > 0) {
    throw new Error("Company is already used by expense forms and cannot be deleted.");
  }

  await prisma.userCompany.delete({ where: { id: companyId } });

  if (existingCompany.logoObjectPath) {
    await deleteR2Object(existingCompany.logoObjectPath, existingCompany.logoBucketName);
  }

  return { companyId };
}
