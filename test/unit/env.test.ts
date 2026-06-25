import { describe, expect, it } from "vitest";
import { getLimits } from "@/config/limits";
import { getServerEnv } from "@/config/env";

describe("environment validation", () => {
  it("parses defaults and numeric limits", () => {
    expect(
      getLimits({ OCR_MAX_FILE_SIZE_MB: "2" } as unknown as NodeJS.ProcessEnv).maxFileSizeBytes
    ).toBe(2 * 1024 * 1024);
    expect(
      getServerEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000"
      } as unknown as NodeJS.ProcessEnv).MISTRAL_OCR_MODEL
    ).toBe("mistral-ocr-4-0");
  });
});
