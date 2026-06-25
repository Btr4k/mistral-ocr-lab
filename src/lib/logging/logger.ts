type SafeLog = {
  requestId?: string;
  event: string;
  route?: string;
  code?: string;
  status?: number;
  durationMs?: number;
  fileType?: string;
  fileSize?: number;
  pageCount?: number;
  upstreamStatusCategory?: string;
};

export function logInfo(entry: SafeLog) {
  log("info", entry);
}

export function logWarn(entry: SafeLog) {
  log("warn", entry);
}

export function logError(entry: SafeLog) {
  log("error", entry);
}

function log(level: "info" | "warn" | "error", entry: SafeLog) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    ...entry
  };
  // Safe structured logs only; never include file names, extracted text, Base64, or upstream bodies.
  console[level](JSON.stringify(payload));
}
