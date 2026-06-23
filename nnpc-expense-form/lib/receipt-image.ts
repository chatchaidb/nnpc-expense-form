import "server-only";

import sharp from "sharp";

const MIN_RECEIPT_BYTES = 75 * 1024;
const MAX_RECEIPT_BYTES = 150 * 1024;
const QUALITY_STEPS = [94, 90, 86, 82, 76, 70, 64];
const WIDTH_STEPS = [2200, 1900, 1700, 1500, 1300, 1100];

export async function compressReceiptImage(input: Buffer) {
  let bestInRange: Buffer | null = null;
  let largestUnderLimit: Buffer | null = null;

  for (const width of WIDTH_STEPS) {
    for (const quality of QUALITY_STEPS) {
      const output = await sharp(input)
        .rotate()
        .resize({ fit: "inside", height: width, width, withoutEnlargement: true })
        .jpeg({ mozjpeg: true, quality })
        .toBuffer();

      if (output.byteLength <= MAX_RECEIPT_BYTES) {
        if (!largestUnderLimit || output.byteLength > largestUnderLimit.byteLength) {
          largestUnderLimit = output;
        }

        if (output.byteLength >= MIN_RECEIPT_BYTES) {
          if (!bestInRange || output.byteLength > bestInRange.byteLength) {
            bestInRange = output;
          }
        }
      }
    }
  }

  const fallback = bestInRange ?? largestUnderLimit ?? input;

  return {
    buffer: fallback,
    mimeType: "image/jpeg",
    size: fallback.byteLength,
  };
}
