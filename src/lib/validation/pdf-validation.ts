import { PDFDocument } from "pdf-lib";
import { UploadValidationError } from "./file-validation";

export async function inspectPdf(buffer: Buffer, maxPages: number) {
  try {
    const pdf = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false
    });
    const pageCount = pdf.getPageCount();
    if (pageCount > maxPages) {
      throw new UploadValidationError("PDF_PAGE_LIMIT_EXCEEDED", "PDF page limit exceeded.");
    }
    return { pageCount };
  } catch (error) {
    if (error instanceof UploadValidationError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("encrypted") || message.includes("password")) {
      throw new UploadValidationError("ENCRYPTED_PDF", "Encrypted PDFs are not supported.");
    }
    throw new UploadValidationError("INVALID_PDF", "The PDF could not be parsed.");
  }
}
