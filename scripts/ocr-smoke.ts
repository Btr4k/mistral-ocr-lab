import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { getLimits } from "@/config/limits";
import { runMistralOcr } from "@/lib/mistral/ocr-client";
import { normalizeOcrResponse } from "@/lib/mistral/ocr-normalizer";
import { EXTENSION_TO_MIME } from "@/lib/security/file-signatures";
import type { ValidatedUpload } from "@/lib/validation/file-validation";

const filePath = process.argv[2];
if (!process.env.MISTRAL_API_KEY) {
  console.error("MISTRAL_API_KEY is required for the manual smoke test.");
  process.exit(1);
}
if (!filePath) {
  console.error("Usage: npm run test:ocr:smoke -- path/to/file.pdf");
  process.exit(1);
}

const ext = basename(filePath).split(".").pop()?.toLowerCase() || "";
const mime = EXTENSION_TO_MIME[ext];
if (!mime) {
  console.error("Unsupported smoke-test file type.");
  process.exit(1);
}

const stat = statSync(filePath);
const limits = getLimits();
if (stat.size > limits.maxFileSizeBytes) {
  console.error("Smoke-test file exceeds configured size limit.");
  process.exit(1);
}

const started = Date.now();
const upload: ValidatedUpload = {
  buffer: readFileSync(filePath),
  name: basename(filePath),
  type: mime,
  size: stat.size,
  extension: ext
};
const model = process.env.MISTRAL_OCR_MODEL || "mistral-ocr-4-0";
const upstream = await runMistralOcr({ upload, timeoutMs: limits.timeoutMs, model });
const normalized = normalizeOcrResponse({
  requestId: "manual-smoke",
  file: { name: upload.name, type: upload.type, size: upload.size },
  durationMs: Date.now() - started,
  model,
  pageCount: 0,
  upstream,
  lowConfidenceThreshold: 0.8
});

console.log(
  JSON.stringify(
    {
      model: normalized.processing.model,
      pageCount: normalized.processing.pageCount,
      durationMs: normalized.processing.durationMs,
      blockCount: normalized.summary.blockCount,
      tableCount: normalized.summary.tableCount,
      confidenceAvailable: normalized.summary.averageConfidence !== null
    },
    null,
    2
  )
);
