import type { OCRApiErrorCode } from "@/types/api";

export class OcrUpstreamError extends Error {
  constructor(
    public code: OCRApiErrorCode,
    message: string,
    public status = 502,
    public retryable = false,
    public retryAfter?: number
  ) {
    super(message);
  }
}

export function classifyMistralError(error: unknown): OcrUpstreamError {
  const maybe = error as {
    statusCode?: number;
    status?: number;
    code?: string;
    name?: string;
    message?: string;
    response?: { status?: number; headers?: Headers };
  };
  const status = maybe.statusCode ?? maybe.status ?? maybe.response?.status;
  const name = maybe.name ?? "";
  const message = maybe.message ?? "Mistral OCR request failed.";

  if (name.includes("Timeout") || message.toLowerCase().includes("timeout")) {
    return new OcrUpstreamError("OCR_TIMEOUT", "OCR request timed out.", 504, true);
  }
  if (name.includes("Abort") || maybe.code === "ABORT_ERR") {
    return new OcrUpstreamError(
      "CLIENT_DISCONNECTED",
      "The OCR request was cancelled.",
      499,
      false
    );
  }
  if (status === 401) {
    return new OcrUpstreamError(
      "OCR_AUTHENTICATION_FAILED",
      "Mistral authentication failed.",
      401
    );
  }
  if (status === 403) {
    return new OcrUpstreamError("OCR_PERMISSION_DENIED", "Mistral permission denied.", 403);
  }
  if (status === 429) {
    return new OcrUpstreamError("OCR_RATE_LIMITED", "Mistral rate limit reached.", 429, true);
  }
  if (status && status >= 500) {
    return new OcrUpstreamError(
      "OCR_SERVICE_UNAVAILABLE",
      "Mistral OCR service is unavailable.",
      503,
      true
    );
  }
  return new OcrUpstreamError("OCR_INVALID_RESPONSE", "Invalid OCR response.", 502, false);
}
