import type { OCRApiError, OCRApiErrorCode } from "@/types/api";

const messages: Record<
  OCRApiErrorCode,
  { message: string; messageAr: string; retryable: boolean }
> = {
  API_NOT_CONFIGURED: {
    message: "OCR API is not configured.",
    messageAr: "واجهة OCR غير مهيأة.",
    retryable: false
  },
  INVALID_CONTENT_TYPE: {
    message: "Request must use multipart/form-data.",
    messageAr: "يجب أن يستخدم الطلب multipart/form-data.",
    retryable: false
  },
  FILE_REQUIRED: {
    message: "A file is required.",
    messageAr: "يجب إرفاق ملف.",
    retryable: false
  },
  MULTIPLE_FILES_NOT_ALLOWED: {
    message: "Only one file is allowed.",
    messageAr: "يسمح بملف واحد فقط.",
    retryable: false
  },
  EMPTY_FILE: { message: "The file is empty.", messageAr: "الملف فارغ.", retryable: false },
  FILE_TOO_LARGE: {
    message: "The file exceeds the size limit.",
    messageAr: "حجم الملف يتجاوز الحد المسموح.",
    retryable: false
  },
  UNSUPPORTED_FILE_TYPE: {
    message: "Unsupported file type.",
    messageAr: "نوع الملف غير مدعوم.",
    retryable: false
  },
  FILE_SIGNATURE_MISMATCH: {
    message: "File signature does not match the declared type.",
    messageAr: "توقيع الملف لا يطابق نوعه المعلن.",
    retryable: false
  },
  PDF_PAGE_LIMIT_EXCEEDED: {
    message: "PDF exceeds the page limit.",
    messageAr: "ملف PDF يتجاوز حد الصفحات.",
    retryable: false
  },
  ENCRYPTED_PDF: {
    message: "Password-protected PDFs are not supported.",
    messageAr: "ملفات PDF المحمية بكلمة مرور غير مدعومة.",
    retryable: false
  },
  INVALID_PDF: {
    message: "The PDF is malformed or unsupported.",
    messageAr: "ملف PDF تالف أو غير مدعوم.",
    retryable: false
  },
  INVALID_IMAGE: {
    message: "The image is malformed or unsupported.",
    messageAr: "الصورة تالفة أو غير مدعومة.",
    retryable: false
  },
  RATE_LIMITED: {
    message: "Too many OCR requests. Please try again shortly.",
    messageAr: "طلبات كثيرة جدًا. يرجى المحاولة بعد قليل.",
    retryable: true
  },
  CONCURRENCY_LIMIT_REACHED: {
    message: "The OCR service is busy. Please try again shortly.",
    messageAr: "الخدمة مشغولة الآن. يرجى المحاولة بعد قليل.",
    retryable: true
  },
  OCR_AUTHENTICATION_FAILED: {
    message: "Mistral authentication failed.",
    messageAr: "فشلت مصادقة Mistral.",
    retryable: false
  },
  OCR_PERMISSION_DENIED: {
    message: "Mistral permission denied.",
    messageAr: "تم رفض صلاحية الوصول إلى Mistral.",
    retryable: false
  },
  OCR_RATE_LIMITED: {
    message: "Mistral rate limit reached.",
    messageAr: "تم بلوغ حد الطلبات لدى Mistral.",
    retryable: true
  },
  OCR_TIMEOUT: {
    message: "OCR processing timed out.",
    messageAr: "انتهت مهلة تحليل المستند.",
    retryable: true
  },
  OCR_SERVICE_UNAVAILABLE: {
    message: "OCR service is temporarily unavailable.",
    messageAr: "خدمة OCR غير متاحة مؤقتًا.",
    retryable: true
  },
  OCR_INVALID_RESPONSE: {
    message: "OCR service returned an invalid response.",
    messageAr: "أعادت خدمة OCR استجابة غير صالحة.",
    retryable: false
  },
  CLIENT_DISCONNECTED: {
    message: "The request was cancelled.",
    messageAr: "تم إلغاء الطلب.",
    retryable: false
  },
  INTERNAL_ERROR: {
    message: "Unexpected server error.",
    messageAr: "حدث خطأ غير متوقع في الخادم.",
    retryable: false
  }
};

export function apiError(code: OCRApiErrorCode, requestId: string): OCRApiError {
  const details = messages[code];
  return {
    error: {
      code,
      message: details.message,
      messageAr: details.messageAr,
      requestId,
      retryable: details.retryable
    }
  };
}

export function jsonError(
  code: OCRApiErrorCode,
  requestId: string,
  status: number,
  extraHeaders?: HeadersInit
) {
  const headers = new Headers(extraHeaders);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-Id", requestId);
  return Response.json(apiError(code, requestId), { status, headers });
}
