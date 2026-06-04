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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Logo preview failed."));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Logo preview failed."));
    };

    reader.readAsDataURL(file);
  });
}

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
  return apiRequest<CompanyRecord>("/api/companies", {
    body: JSON.stringify({
      companyAddress,
      companyName,
      companyTaxId,
      logoDataUrl: await readFileAsDataUrl(logoFile),
      originalLogoFileName: logoFile.name,
    }),
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
  return apiRequest<CompanyRecord>("/api/companies", {
    body: JSON.stringify({
      companyAddress,
      companyId,
      companyName,
      companyTaxId,
      ...(logoFile
        ? {
            logoDataUrl: await readFileAsDataUrl(logoFile),
            originalLogoFileName: logoFile.name,
          }
        : {}),
    }),
    method: "PATCH",
  });
}
