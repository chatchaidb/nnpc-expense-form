import {
  buildPublicStorageUrl,
  COMPANY_ASSETS_BUCKET,
  createScopedObjectPath,
  removeStorageObjects,
  SESSION_EXPIRED_MESSAGE,
  supabaseJsonRequest,
  uploadStorageObject,
} from "@/lib/supabase-api";
import {
  isLocalDevelopmentAccessToken,
  readLocalStorageJson,
  writeLocalStorageJson,
} from "@/lib/local-mode";

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

type CompanyRow = {
  id: string;
  company_address: string | null;
  company_name: string;
  company_tax_id: string | null;
  logo_data_url: string | null;
  logo_bucket_name: string | null;
  logo_object_path: string | null;
  original_logo_file_name: string | null;
  created_at: string;
};

const LOCAL_COMPANIES_KEY = "nnpc-local-companies";

function readLocalCompanies() {
  return readLocalStorageJson<CompanyRecord[]>(LOCAL_COMPANIES_KEY, []);
}

function writeLocalCompanies(companies: CompanyRecord[]) {
  writeLocalStorageJson(LOCAL_COMPANIES_KEY, companies);
}

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

function mapCompanyRow(row: CompanyRow): CompanyRecord {
  const logoBucketName = row.logo_bucket_name;
  const logoObjectPath = row.logo_object_path;

  return {
    id: row.id,
    companyAddress: row.company_address ?? "",
    companyName: row.company_name,
    companyTaxId: row.company_tax_id ?? "",
    logoUrl:
      logoBucketName && logoObjectPath
        ? buildPublicStorageUrl(logoBucketName, logoObjectPath)
        : row.logo_data_url ?? "",
    logoBucketName,
    logoObjectPath,
    originalLogoFileName: row.original_logo_file_name,
    createdAt: row.created_at,
  };
}

export { SESSION_EXPIRED_MESSAGE };

export async function listUserCompanies(accessToken: string) {
  if (isLocalDevelopmentAccessToken(accessToken)) {
    return readLocalCompanies();
  }

  const rows = await supabaseJsonRequest<CompanyRow[]>({
    accessToken,
    path: "user_companies?select=id,company_address,company_name,company_tax_id,logo_data_url,logo_bucket_name,logo_object_path,original_logo_file_name,created_at&order=created_at.desc",
  });

  return rows.map(mapCompanyRow);
}

export async function createUserCompany({
  accessToken,
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
  if (isLocalDevelopmentAccessToken(accessToken)) {
    const logoUrl = await readFileAsDataUrl(logoFile);
    const nextCompany = {
      companyAddress: companyAddress.trim(),
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim(),
      createdAt: new Date().toISOString(),
      id: `local-company-${Date.now()}`,
      logoBucketName: null,
      logoObjectPath: null,
      logoUrl,
      originalLogoFileName: logoFile.name,
    } satisfies CompanyRecord;
    const nextCompanies = [nextCompany, ...readLocalCompanies()];

    writeLocalCompanies(nextCompanies);
    return nextCompany;
  }

  const objectPath = createScopedObjectPath({
    accessToken,
    fileName: logoFile.name,
    folder: "companies",
  });

  await uploadStorageObject({
    accessToken,
    bucketName: COMPANY_ASSETS_BUCKET,
    contentType: logoFile.type,
    file: logoFile,
    objectPath,
  });

  const rows = await supabaseJsonRequest<CompanyRow[]>({
    accessToken,
    body: [
      {
        company_address: companyAddress.trim() || null,
        company_name: companyName.trim(),
        company_tax_id: companyTaxId.trim() || null,
        logo_data_url: null,
        logo_bucket_name: COMPANY_ASSETS_BUCKET,
        logo_object_path: objectPath,
        original_logo_file_name: logoFile.name,
      },
    ],
    headers: {
      Prefer: "return=representation",
    },
    method: "POST",
    path: "user_companies?select=id,company_address,company_name,company_tax_id,logo_data_url,logo_bucket_name,logo_object_path,original_logo_file_name,created_at",
  });

  const [firstRow] = rows;

  if (!firstRow) {
    throw new Error("Supabase did not return the newly created company.");
  }

  return mapCompanyRow(firstRow);
}

export async function updateUserCompany({
  accessToken,
  companyAddress,
  companyId,
  companyName,
  companyTaxId,
  currentCompany,
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
  if (isLocalDevelopmentAccessToken(accessToken)) {
    const logoUrl = logoFile ? await readFileAsDataUrl(logoFile) : currentCompany.logoObjectPath ?? "";
    const currentCompanies = readLocalCompanies();
    const existingCompany = currentCompanies.find((company) => company.id === companyId);
    const nextCompany = {
      companyAddress: companyAddress.trim(),
      companyName: companyName.trim(),
      companyTaxId: companyTaxId.trim(),
      createdAt: existingCompany?.createdAt ?? new Date().toISOString(),
      id: companyId,
      logoBucketName: null,
      logoObjectPath: null,
      logoUrl: logoFile ? logoUrl : existingCompany?.logoUrl ?? "",
      originalLogoFileName: logoFile?.name ?? existingCompany?.originalLogoFileName ?? null,
    } satisfies CompanyRecord;

    writeLocalCompanies(
      currentCompanies.map((company) => (company.id === companyId ? nextCompany : company)),
    );
    return nextCompany;
  }

  let uploadedObjectPath: string | null = null;

  try {
    const nextBody: Record<string, string | null> = {
      company_address: companyAddress.trim() || null,
      company_name: companyName.trim(),
      company_tax_id: companyTaxId.trim() || null,
    };

    if (logoFile) {
      uploadedObjectPath = createScopedObjectPath({
        accessToken,
        fileName: logoFile.name,
        folder: "companies",
      });

      await uploadStorageObject({
        accessToken,
        bucketName: COMPANY_ASSETS_BUCKET,
        contentType: logoFile.type,
        file: logoFile,
        objectPath: uploadedObjectPath,
      });

      nextBody.logo_data_url = null;
      nextBody.logo_bucket_name = COMPANY_ASSETS_BUCKET;
      nextBody.logo_object_path = uploadedObjectPath;
      nextBody.original_logo_file_name = logoFile.name;
    }

    const rows = await supabaseJsonRequest<CompanyRow[]>({
      accessToken,
      body: nextBody,
      headers: {
        Prefer: "return=representation",
      },
      method: "PATCH",
      path: `user_companies?id=eq.${encodeURIComponent(companyId)}&select=id,company_address,company_name,company_tax_id,logo_data_url,logo_bucket_name,logo_object_path,original_logo_file_name,created_at`,
    });

    const [firstRow] = rows;

    if (!firstRow) {
      throw new Error("Supabase did not return the updated company.");
    }

    if (
      uploadedObjectPath &&
      currentCompany.logoBucketName &&
      currentCompany.logoObjectPath &&
      currentCompany.logoObjectPath !== uploadedObjectPath
    ) {
      void removeStorageObjects({
        accessToken,
        bucketName: currentCompany.logoBucketName,
        objectPaths: [currentCompany.logoObjectPath],
      }).catch(() => undefined);
    }

    return mapCompanyRow(firstRow);
  } catch (error) {
    if (uploadedObjectPath) {
      void removeStorageObjects({
        accessToken,
        bucketName: COMPANY_ASSETS_BUCKET,
        objectPaths: [uploadedObjectPath],
      }).catch(() => undefined);
    }

    throw error;
  }
}
