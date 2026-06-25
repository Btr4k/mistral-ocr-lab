import { performance } from "node:perf_hooks";
import type { NextRequest } from "next/server";
import { getServerEnv, isMistralConfigured } from "@/config/env";
import { getLimits } from "@/config/limits";
import { jsonError } from "@/lib/api/errors";
import { rateLimitKey } from "@/lib/api/client-ip";
import { logError, logInfo, logWarn } from "@/lib/logging/logger";
import { OcrUpstreamError } from "@/lib/mistral/ocr-errors";
import { runMistralOcr } from "@/lib/mistral/ocr-client";
import { normalizeOcrResponse } from "@/lib/mistral/ocr-normalizer";
import { releaseSlot, tryAcquireSlot } from "@/lib/security/concurrency";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createRequestId } from "@/lib/security/request-id";
import { UploadValidationError, validateUploadedFile } from "@/lib/validation/file-validation";
import { inspectPdf } from "@/lib/validation/pdf-validation";
import type { OCRApiErrorCode } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const limits = getLimits();
  const env = getServerEnv();
  const startedAt = performance.now();
  let acquired = false;
  let uploadType: string | undefined;
  let uploadSize: number | undefined;
  let pageCount = 0;

  try {
    if (!isMistralConfigured()) {
      return jsonError("API_NOT_CONFIGURED", requestId, 503);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return jsonError("INVALID_CONTENT_TYPE", requestId, 400);
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > limits.maxFileSizeBytes + 1024 * 1024) {
      return jsonError("FILE_TOO_LARGE", requestId, 413);
    }

    const rate = checkRateLimit(rateLimitKey(request), limits.rateLimitPerMinute);
    if (!rate.allowed) {
      return jsonError("RATE_LIMITED", requestId, 429, {
        "Retry-After": String(rate.retryAfter)
      });
    }

    if (!tryAcquireSlot(limits.maxConcurrentJobs)) {
      return jsonError("CONCURRENCY_LIMIT_REACHED", requestId, 429, { "Retry-After": "10" });
    }
    acquired = true;

    const formData = await request.formData();
    const files = Array.from(formData.values()).filter(isFileLike);
    if (files.length === 0) return jsonError("FILE_REQUIRED", requestId, 400);
    if (files.length > 1) return jsonError("MULTIPLE_FILES_NOT_ALLOWED", requestId, 400);

    const upload = await validateUploadedFile(files[0], limits.maxFileSizeBytes);
    uploadType = upload.type;
    uploadSize = upload.size;
    if (upload.type === "application/pdf") {
      pageCount = (await inspectPdf(upload.buffer, limits.maxPages)).pageCount;
    } else {
      pageCount = 1;
    }

    const upstream = await runMistralOcr({
      upload,
      timeoutMs: limits.timeoutMs,
      model: env.MISTRAL_OCR_MODEL,
      signal: request.signal
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const normalized = normalizeOcrResponse({
      requestId,
      file: {
        name: upload.name,
        type: upload.type,
        size: upload.size
      },
      durationMs,
      model: env.MISTRAL_OCR_MODEL,
      pageCount,
      upstream,
      lowConfidenceThreshold: limits.lowConfidenceThreshold
    });

    logInfo({
      requestId,
      event: "ocr_success",
      route: "/api/ocr",
      status: 200,
      durationMs,
      fileType: upload.type,
      fileSize: upload.size,
      pageCount
    });
    return Response.json(normalized, {
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId
      }
    });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const { code, status, retryAfter } = classifyError(error);
    const log = status >= 500 ? logError : logWarn;
    log({
      requestId,
      event: "ocr_error",
      route: "/api/ocr",
      code,
      status,
      durationMs,
      fileType: uploadType,
      fileSize: uploadSize,
      pageCount,
      upstreamStatusCategory:
        error instanceof OcrUpstreamError ? String(error.status) : undefined
    });
    const headers = retryAfter ? { "Retry-After": String(retryAfter) } : undefined;
    return jsonError(code, requestId, normalizeStatus(status), headers);
  } finally {
    if (acquired) releaseSlot();
  }
}

function classifyError(error: unknown): {
  code: OCRApiErrorCode;
  status: number;
  retryAfter?: number;
} {
  if (error instanceof UploadValidationError) {
    const statusByCode: Partial<Record<OCRApiErrorCode, number>> = {
      EMPTY_FILE: 400,
      FILE_TOO_LARGE: 413,
      UNSUPPORTED_FILE_TYPE: 415,
      FILE_SIGNATURE_MISMATCH: 415,
      PDF_PAGE_LIMIT_EXCEEDED: 422,
      ENCRYPTED_PDF: 422,
      INVALID_PDF: 422,
      INVALID_IMAGE: 422
    };
    return { code: error.code, status: statusByCode[error.code] ?? 400 };
  }
  if (error instanceof OcrUpstreamError) {
    return { code: error.code, status: error.status, retryAfter: error.retryAfter };
  }
  return { code: "INTERNAL_ERROR", status: 500 };
}

function normalizeStatus(status: number) {
  return status === 499 ? 400 : status;
}

function isFileLike(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "type" in value &&
    "size" in value
  );
}
