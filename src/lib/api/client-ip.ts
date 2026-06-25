import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

export function rateLimitKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const raw = forwarded?.split(",")[0]?.trim() || realIp || "unknown";
  return createHash("sha256").update(raw).digest("hex");
}
