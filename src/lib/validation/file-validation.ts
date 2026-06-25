import {
  extensionMatchesMime,
  getExtension,
  isAllowedMimeType,
  signatureMatches
} from "@/lib/security/file-signatures";
import type { OCRApiErrorCode } from "@/types/api";

export type ValidatedUpload = {
  buffer: Buffer;
  name: string;
  type: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  size: number;
  extension: string;
};

export class UploadValidationError extends Error {
  constructor(
    public code: OCRApiErrorCode,
    message: string
  ) {
    super(message);
  }
}

export async function validateUploadedFile(file: File, maxFileSizeBytes: number) {
  if (file.size === 0)
    throw new UploadValidationError("EMPTY_FILE", "Empty files are not allowed.");
  if (file.size > maxFileSizeBytes) {
    throw new UploadValidationError("FILE_TOO_LARGE", "The selected file is too large.");
  }
  if (!isAllowedMimeType(file.type)) {
    throw new UploadValidationError("UNSUPPORTED_FILE_TYPE", "Unsupported file type.");
  }
  const extension = getExtension(file.name);
  if (!extension || !extensionMatchesMime(file.name, file.type)) {
    throw new UploadValidationError(
      "UNSUPPORTED_FILE_TYPE",
      "File extension does not match MIME type."
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!signatureMatches(buffer, file.type)) {
    throw new UploadValidationError(
      "FILE_SIGNATURE_MISMATCH",
      "File signature does not match the declared type."
    );
  }

  return {
    buffer,
    name: file.name,
    type: file.type,
    size: file.size,
    extension
  } satisfies ValidatedUpload;
}
