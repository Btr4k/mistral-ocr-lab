// @vitest-environment node
import { File as NodeFile } from "node:buffer";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConcurrency, tryAcquireSlot } from "@/lib/security/concurrency";
import { resetRateLimiter } from "@/lib/security/rate-limit";

const runMistralOcr = vi.fn();

vi.mock("@/lib/mistral/ocr-client", () => ({
  runMistralOcr
}));

function requestWithForm(form: FormData, headers?: HeadersInit) {
  return new Request("http://localhost/api/ocr", {
    method: "POST",
    body: form,
    headers
  }) as unknown as NextRequest;
}

function pngFile() {
  return new NodeFile(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    "sample.png",
    {
      type: "image/png"
    }
  );
}

function appendFile(form: FormData, file: NodeFile, field = "file") {
  form.append(field, file as unknown as Blob, file.name);
}

describe("POST /api/ocr", () => {
  beforeEach(() => {
    process.env.MISTRAL_API_KEY = "test-key";
    process.env.OCR_RATE_LIMIT_PER_MINUTE = "100";
    process.env.OCR_MAX_CONCURRENT_JOBS = "2";
    process.env.OCR_MAX_FILE_SIZE_MB = "10";
    resetRateLimiter();
    resetConcurrency();
    runMistralOcr.mockResolvedValue({
      model: "mistral-ocr-4-0",
      pages: [
        {
          index: 0,
          markdown: "Hello",
          dimensions: { width: 100, height: 100, dpi: 72 },
          images: [],
          tables: [
            {
              id: "t1",
              content: "<table><tr><td onclick='x'>A</td></tr></table>",
              format: "html"
            }
          ],
          blocks: [
            {
              type: "text",
              content: "Hello",
              topLeftX: 1,
              topLeftY: 1,
              bottomRightX: 10,
              bottomRightY: 10
            }
          ],
          confidenceScores: {
            averagePageConfidenceScore: 0.9,
            minimumPageConfidenceScore: 0.9,
            wordConfidenceScores: [{ text: "Hello", confidence: 0.9, startIndex: 0 }]
          }
        }
      ],
      usageInfo: { pagesProcessed: 1, docSizeBytes: 10 }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing multipart content type", async () => {
    const { POST } = await import("@/app/api/ocr/route");
    const response = await POST(
      new NextRequest("http://localhost/api/ocr", {
        method: "POST",
        body: "x",
        headers: { "content-type": "text/plain" }
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects missing and multiple files", async () => {
    const { POST } = await import("@/app/api/ocr/route");
    const empty = new FormData();
    expect((await POST(requestWithForm(empty))).status).toBe(400);
    const multi = new FormData();
    appendFile(multi, pngFile(), "a");
    appendFile(multi, pngFile(), "b");
    expect((await POST(requestWithForm(multi))).status).toBe(400);
  });

  it("rejects unsupported, empty, oversized, and signature mismatch files", async () => {
    const { POST } = await import("@/app/api/ocr/route");
    const empty = new FormData();
    appendFile(empty, new NodeFile([], "x.pdf", { type: "application/pdf" }));
    expect((await POST(requestWithForm(empty))).status).toBe(400);

    const unsupported = new FormData();
    appendFile(unsupported, new NodeFile(["x"], "x.svg", { type: "image/svg+xml" }));
    expect((await POST(requestWithForm(unsupported))).status).toBe(415);

    const mismatch = new FormData();
    appendFile(mismatch, new NodeFile(["not"], "x.pdf", { type: "application/pdf" }));
    expect((await POST(requestWithForm(mismatch))).status).toBe(415);

    process.env.OCR_MAX_FILE_SIZE_MB = "1";
    const over = new FormData();
    appendFile(
      over,
      new NodeFile([new Uint8Array(1024 * 1024 + 1)], "x.png", { type: "image/png" })
    );
    expect(
      (await POST(requestWithForm(over, { "content-length": String(2 * 1024 * 1024) }))).status
    ).toBe(413);
  });

  it("returns missing configuration safely", async () => {
    delete process.env.MISTRAL_API_KEY;
    const { POST } = await import("@/app/api/ocr/route");
    const form = new FormData();
    appendFile(form, pngFile());
    const response = await POST(requestWithForm(form));
    const json = await response.json();
    expect(response.status).toBe(503);
    expect(json.error.code).toBe("API_NOT_CONFIGURED");
  });

  it("returns mocked OCR success with request id, no-store, and sanitized table output", async () => {
    const { POST } = await import("@/app/api/ocr/route");
    const form = new FormData();
    appendFile(form, pngFile());
    const response = await POST(requestWithForm(form));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(json.pages[0].tables[0].html).not.toContain("onclick");
  });

  it("normalizes upstream auth, rate limit, timeout, and invalid response errors", async () => {
    const { OcrUpstreamError } = await import("@/lib/mistral/ocr-errors");
    const { POST } = await import("@/app/api/ocr/route");
    for (const [code, status] of [
      ["OCR_AUTHENTICATION_FAILED", 401],
      ["OCR_RATE_LIMITED", 429],
      ["OCR_TIMEOUT", 504],
      ["OCR_INVALID_RESPONSE", 502]
    ] as const) {
      runMistralOcr.mockRejectedValueOnce(
        new OcrUpstreamError(code, code, status, code !== "OCR_INVALID_RESPONSE")
      );
      const form = new FormData();
      appendFile(form, pngFile());
      const response = await POST(requestWithForm(form));
      const json = await response.json();
      expect(response.status).toBe(status);
      expect(json.error.code).toBe(code);
    }
  });

  it("rejects by concurrency and application rate limit", async () => {
    process.env.OCR_MAX_CONCURRENT_JOBS = "1";
    const { POST } = await import("@/app/api/ocr/route");
    tryAcquireSlot(1);
    const concurrent = new FormData();
    appendFile(concurrent, pngFile());
    expect((await POST(requestWithForm(concurrent))).status).toBe(429);
    resetConcurrency();

    process.env.OCR_MAX_CONCURRENT_JOBS = "2";
    process.env.OCR_RATE_LIMIT_PER_MINUTE = "1";
    resetRateLimiter();
    const a = new FormData();
    appendFile(a, pngFile());
    expect((await POST(requestWithForm(a))).status).toBe(200);
    const b = new FormData();
    appendFile(b, pngFile());
    expect((await POST(requestWithForm(b))).status).toBe(429);
  });
});
