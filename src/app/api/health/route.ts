import { getServerEnv, isMistralConfigured } from "@/config/env";
import type { HealthResponse } from "@/types/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const env = getServerEnv();
  const configured = isMistralConfigured();
  const body: HealthResponse = {
    status: configured ? "ready" : "not_configured",
    configured,
    model: env.MISTRAL_OCR_MODEL,
    timestamp: new Date().toISOString()
  };
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
