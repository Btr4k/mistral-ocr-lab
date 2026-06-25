import type { ValidatedUpload } from "@/lib/validation/file-validation";

export function toMistralDocument(upload: ValidatedUpload) {
  const base64 = upload.buffer.toString("base64");
  const dataUrl = `data:${upload.type};base64,${base64}`;
  if (upload.type === "application/pdf") {
    return {
      type: "document_url" as const,
      documentUrl: dataUrl,
      documentName: "upload.pdf"
    };
  }
  return {
    type: "image_url" as const,
    imageUrl: dataUrl
  };
}
