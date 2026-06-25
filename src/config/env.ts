import { z } from "zod";

const envSchema = z.object({
  MISTRAL_API_KEY: z.string().optional(),
  MISTRAL_OCR_MODEL: z.string().default("mistral-ocr-4-0"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export function getServerEnv(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}

export function isMistralConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(getServerEnv(env).MISTRAL_API_KEY);
}
