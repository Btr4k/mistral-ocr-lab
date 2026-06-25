import { z } from "zod";

const positiveIntFromEnv = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : fallback))
    .pipe(z.number().int().positive());

const limitsSchema = z.object({
  maxFileSizeMb: positiveIntFromEnv(10),
  maxPages: positiveIntFromEnv(15),
  timeoutMs: positiveIntFromEnv(180_000),
  maxConcurrentJobs: positiveIntFromEnv(2),
  rateLimitPerMinute: positiveIntFromEnv(3),
  lowConfidenceThreshold: z.number().min(0).max(1).default(0.8)
});

export function getLimits(env: NodeJS.ProcessEnv = process.env) {
  const parsed = limitsSchema.parse({
    maxFileSizeMb: env.OCR_MAX_FILE_SIZE_MB,
    maxPages: env.OCR_MAX_PAGES,
    timeoutMs: env.OCR_TIMEOUT_MS,
    maxConcurrentJobs: env.OCR_MAX_CONCURRENT_JOBS,
    rateLimitPerMinute: env.OCR_RATE_LIMIT_PER_MINUTE,
    lowConfidenceThreshold: 0.8
  });

  return {
    ...parsed,
    maxFileSizeBytes: parsed.maxFileSizeMb * 1024 * 1024
  };
}

export type OcrLimits = ReturnType<typeof getLimits>;
