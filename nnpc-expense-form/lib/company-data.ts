import { apiRequest, SESSION_EXPIRED_MESSAGE } from "@/lib/api-client";

export { SESSION_EXPIRED_MESSAGE };

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

export async function listUserCompanies(accessToken: string) {
  void accessToken;
  return apiRequest<CompanyRecord[]>("/api/companies");
}

export async function createUserCompany({
  companyAddress,
  companyName,
  companyTaxId,
  logoFile,
}: {
  accessToken: string;
  companyAddress: string;
  companyName: string;
  companyTaxId: string;
  logoFile: File;
}) {
  const formData = new FormData();
  formData.set("companyAddress", companyAddress);
  formData.set("companyName", companyName);
  formData.set("companyTaxId", companyTaxId);
  formData.set("logoFile", logoFile);

  return apiRequest<CompanyRecord>("/api/companies", {
    body: formData,
    method: "POST",
  });
}

export async function updateUserCompany({
  companyAddress,
  companyId,
  companyName,
  companyTaxId,
  logoFile,
}: {
  accessToken: string;
  companyAddress: string;
  companyId: string;
  companyName: string;
  companyTaxId: string;
  currentCompany: Pick<
    CompanyRecord,
    "id" | "logoBucketName" | "logoObjectPath" | "originalLogoFileName"
  >;
  logoFile?: File | null;
}) {
  const formData = new FormData();
  formData.set("companyAddress", companyAddress);
  formData.set("companyId", companyId);
  formData.set("companyName", companyName);
  formData.set("companyTaxId", companyTaxId);

  if (logoFile) {
    formData.set("logoFile", logoFile);
  }

  return apiRequest<CompanyRecord>("/api/companies", {
    body: formData,
    method: "PATCH",
  });
}

export async function deleteUserCompany({
  companyId,
}: {
  accessToken: string;
  companyId: string;
}) {
  return apiRequest<{ companyId: string }>(
    `/api/companies?companyId=${encodeURIComponent(companyId)}`,
    {
      method: "DELETE",
    },
  );
}
