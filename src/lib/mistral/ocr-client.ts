import { Mistral } from "@mistralai/mistralai";
import { getServerEnv } from "@/config/env";
import type { ValidatedUpload } from "@/lib/validation/file-validation";
import { toMistralDocument } from "./ocr-input";
import { classifyMistralError } from "./ocr-errors";

export type RunOcrOptions = {
  upload: ValidatedUpload;
  timeoutMs: number;
  model: string;
  signal?: AbortSignal;
};

export async function runMistralOcr({ upload, timeoutMs, model, signal }: RunOcrOptions) {
  const env = getServerEnv();
  if (!env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY is not configured.");
  }

  const client = new Mistral({ apiKey: env.MISTRAL_API_KEY });
  try {
    return await client.ocr.process(
      {
        model,
        document: toMistralDocument(upload),
        includeBlocks: true,
        confidenceScoresGranularity: "word",
        tableFormat: "html",
        extractHeader: true,
        extractFooter: true,
        includeImageBase64: false
      },
      {
        timeoutMs,
        signal,
        retries: {
          strategy: "backoff",
          backoff: {
            initialInterval: 500,
            maxInterval: 1500,
            exponent: 2,
            maxElapsedTime: 2500
          },
          retryConnectionErrors: true
        },
        retryCodes: ["5XX", "429"]
      }
    );
  } catch (error) {
    throw classifyMistralError(error);
  }
}
