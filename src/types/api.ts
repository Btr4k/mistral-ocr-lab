export type HealthStatus = "ready" | "not_configured" | "unavailable";

export type HealthResponse = {
  status: HealthStatus;
  configured: boolean;
  model: string;
  timestamp: string;
};

export type OCRApiErrorCode =
  | "API_NOT_CONFIGURED"
  | "INVALID_CONTENT_TYPE"
  | "FILE_REQUIRED"
  | "MULTIPLE_FILES_NOT_ALLOWED"
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_SIGNATURE_MISMATCH"
  | "PDF_PAGE_LIMIT_EXCEEDED"
  | "ENCRYPTED_PDF"
  | "INVALID_PDF"
  | "INVALID_IMAGE"
  | "RATE_LIMITED"
  | "CONCURRENCY_LIMIT_REACHED"
  | "OCR_AUTHENTICATION_FAILED"
  | "OCR_PERMISSION_DENIED"
  | "OCR_RATE_LIMITED"
  | "OCR_TIMEOUT"
  | "OCR_SERVICE_UNAVAILABLE"
  | "OCR_INVALID_RESPONSE"
  | "CLIENT_DISCONNECTED"
  | "INTERNAL_ERROR";

export type OCRApiError = {
  error: {
    code: OCRApiErrorCode;
    message: string;
    messageAr: string;
    requestId: string;
    retryable: boolean;
  };
};
