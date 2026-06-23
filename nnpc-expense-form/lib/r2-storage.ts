import "server-only";

import { createHash, createHmac, randomUUID } from "crypto";

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const RECEIPT_OBJECT_PREFIX = "expense-receipts";
const COMPANY_OBJECT_PREFIX = "company-assets";

type R2Config = {
  accessKeyId: string;
  accountId: string;
  bucket: string;
  endpoint: string;
  publicBucketUrl: string;
  secretAccessKey: string;
};

type UploadObjectInput = {
  body: Buffer;
  bucketName?: string;
  contentType: string;
  objectPath: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for R2 storage.`);
  }

  return value;
}

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const endpoint =
    process.env.R2_S3_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  return {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    accountId: requireEnv("R2_ACCOUNT_ID"),
    bucket: requireEnv("R2_BUCKET"),
    endpoint: endpoint.replace(/\/+$/, ""),
    publicBucketUrl: requireEnv("R2_PUBLIC_BUCKET_URL").replace(/\/+$/, ""),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  };
}

function hashHex(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toDateStamp(amzDate: string) {
  return amzDate.slice(0, 8);
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodePathSegment).join("/");
}

function createSigningKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, R2_REGION);
  const serviceKey = hmac(regionKey, R2_SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function buildAuthorizationHeader({
  amzDate,
  config,
  contentHash,
  contentType,
  method,
  pathname,
}: {
  amzDate: string;
  config: R2Config;
  contentHash: string;
  contentType?: string;
  method: "DELETE" | "PUT";
  pathname: string;
}) {
  const dateStamp = toDateStamp(amzDate);
  const host = new URL(config.endpoint).host;
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const signedHeaders = contentType
    ? "content-type;host;x-amz-content-sha256;x-amz-date"
    : "host;x-amz-content-sha256;x-amz-date";
  const canonicalHeaders = contentType
    ? `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`
    : `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${amzDate}\n`;
  const canonicalRequest = [
    method,
    pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join("\n");
  const signature = hmacHex(createSigningKey(config.secretAccessKey, dateStamp), stringToSign);

  return `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function r2Fetch({
  body,
  bucketName,
  contentType,
  method,
  objectPath,
}: UploadObjectInput & {
  method: "DELETE" | "PUT";
}) {
  const config = getR2Config();
  void bucketName;
  const bucket = config.bucket;
  const encodedObjectPath = encodeObjectPath(objectPath);
  const pathname = `/${bucket}/${encodedObjectPath}`;
  const contentHash = hashHex(body);
  const amzDate = toAmzDate(new Date());
  const headers = new Headers({
    Authorization: buildAuthorizationHeader({
      amzDate,
      config,
      contentHash,
      contentType: method === "PUT" ? contentType : undefined,
      method,
      pathname,
    }),
    "x-amz-content-sha256": contentHash,
    "x-amz-date": amzDate,
  });

  if (method === "PUT") {
    headers.set("Content-Type", contentType);
  }

  const response = await fetch(`${config.endpoint}${pathname}`, {
    body: method === "PUT" ? new Blob([body as unknown as BlobPart]) : undefined,
    headers,
    method,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `R2 ${method} failed for ${objectPath}: ${response.status} ${response.statusText}${
        responseText ? ` ${responseText}` : ""
      }`,
    );
  }
}

export function sanitizeObjectPathPart(value: string) {
  return (
    value
      .trim()
      .replace(/[/\\]/g, "-")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 96) || "file"
  );
}

export function createReceiptObjectPath({
  expenseDate,
  fileName,
  rowId,
  userId,
}: {
  expenseDate: string;
  fileName: string;
  rowId: number | string;
  userId: string;
}) {
  return `${RECEIPT_OBJECT_PREFIX}/${userId}/${sanitizeObjectPathPart(expenseDate)}/row-${sanitizeObjectPathPart(
    String(rowId),
  )}/${randomUUID()}-${sanitizeObjectPathPart(fileName)}`;
}

export function createCompanyLogoObjectPath({
  companyId,
  fileName,
}: {
  companyId: string;
  fileName: string;
}) {
  return `${COMPANY_OBJECT_PREFIX}/${companyId}/${randomUUID()}-${sanitizeObjectPathPart(fileName)}`;
}

export function getPublicObjectUrl(objectPath: string) {
  if (!objectPath.trim()) {
    return "";
  }

  return `${getR2Config().publicBucketUrl}/${encodeObjectPath(objectPath)}`;
}

export function getR2BucketName() {
  return getR2Config().bucket;
}

export async function uploadR2Object(input: UploadObjectInput) {
  await r2Fetch({ ...input, method: "PUT" });
}

export async function fetchR2Object(objectPath: string, bucketName?: string | null) {
  void bucketName;
  const publicUrl = getPublicObjectUrl(objectPath);
  const response = await fetch(publicUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `R2 GET failed for ${objectPath}: ${response.status} ${response.statusText}`,
    );
  }

  return {
    body: response.body,
    contentLength: response.headers.get("content-length"),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export async function deleteR2Object(objectPath: string, bucketName?: string | null) {
  if (!objectPath.trim() || objectPath.startsWith("data:") || /^https?:\/\//i.test(objectPath)) {
    return;
  }

  await r2Fetch({
    body: Buffer.alloc(0),
    bucketName: bucketName ?? undefined,
    contentType: "application/octet-stream",
    method: "DELETE",
    objectPath,
  }).catch((error: unknown) => {
    console.error(error);
  });
}

export { COMPANY_OBJECT_PREFIX, RECEIPT_OBJECT_PREFIX };
