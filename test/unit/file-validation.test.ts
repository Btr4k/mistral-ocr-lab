import { describe, expect, it } from "vitest";
import { validateUploadedFile } from "@/lib/validation/file-validation";

describe("upload validation", () => {
  it("rejects empty files, unsupported MIME, extension mismatch, and signature mismatch", async () => {
    await expect(
      validateUploadedFile(new File([], "a.pdf", { type: "application/pdf" }), 100)
    ).rejects.toMatchObject({
      code: "EMPTY_FILE"
    });
    await expect(
      validateUploadedFile(new File(["x"], "a.svg", { type: "image/svg+xml" }), 100)
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE"
    });
    await expect(
      validateUploadedFile(new File(["%PDF-"], "a.png", { type: "image/png" }), 100)
    ).rejects.toMatchObject({
      code: "FILE_SIGNATURE_MISMATCH"
    });
    await expect(
      validateUploadedFile(new File(["%PDF-"], "a.jpg", { type: "application/pdf" }), 100)
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_FILE_TYPE"
    });
  });
});
