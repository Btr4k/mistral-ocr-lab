import { describe, expect, it } from "vitest";
import { blockToPercentBox } from "@/lib/document/bounding-box";
import {
  normalizeOcrResponse,
  normalizeBlockType,
  sanitizeRaw
} from "@/lib/mistral/ocr-normalizer";
import { signatureMatches } from "@/lib/security/file-signatures";
import { exportFilename } from "@/lib/security/safe-filename";
import { sanitizeTableHtml } from "@/lib/security/sanitize-table";
import { checkRateLimit, resetRateLimiter } from "@/lib/security/rate-limit";
import {
  getActiveJobs,
  releaseSlot,
  resetConcurrency,
  tryAcquireSlot
} from "@/lib/security/concurrency";
import type { OCRBlock } from "@/types/ocr";

describe("file signatures", () => {
  it("validates PDF, PNG, JPEG, and WebP signatures", () => {
    expect(signatureMatches(Buffer.from("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(
      signatureMatches(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        "image/png"
      )
    ).toBe(true);
    expect(signatureMatches(Buffer.from([0xff, 0xd8, 0xff, 0xdb]), "image/jpeg")).toBe(true);
    expect(signatureMatches(Buffer.from("RIFFxxxxWEBP"), "image/webp")).toBe(true);
    expect(signatureMatches(Buffer.from("not-pdf"), "application/pdf")).toBe(false);
  });
});

describe("safe filenames", () => {
  it("removes path separators and reserved characters", () => {
    expect(exportFilename("../invoice:2026.pdf", "ocr", "json")).toBe("invoice-2026-ocr.json");
  });
});

describe("bounding boxes", () => {
  const base: OCRBlock = {
    id: "b",
    pageIndex: 0,
    index: 0,
    type: "text",
    originalType: "text",
    content: "hello",
    tableId: null,
    imageId: null,
    confidence: null,
    bbox: { topLeftX: 10, topLeftY: 20, bottomRightX: 60, bottomRightY: 70 }
  };

  it("calculates percentages", () => {
    expect(blockToPercentBox(base, 100, 100)).toEqual({
      left: 10,
      top: 20,
      width: 50,
      height: 50
    });
  });

  it("ignores invalid coordinates", () => {
    expect(
      blockToPercentBox({ ...base, bbox: { ...base.bbox!, bottomRightX: 1 } }, 100, 100)
    ).toBeNull();
  });
});

describe("normalization", () => {
  it("handles confidence summary, unknown block type, tables, and raw sanitization", () => {
    const normalized = normalizeOcrResponse({
      requestId: "r",
      file: { name: "x.pdf", type: "application/pdf", size: 10 },
      durationMs: 9,
      model: "mistral-ocr-4-0",
      pageCount: 1,
      lowConfidenceThreshold: 0.8,
      upstream: {
        model: "mistral-ocr-4-0",
        pages: [
          {
            index: 0,
            markdown: "Hello world",
            dimensions: { width: 100, height: 200, dpi: 72 },
            images: [],
            tables: [
              {
                id: "t1",
                content: "<table><tr><td onclick=x>Hi</td></tr></table>",
                format: "html"
              }
            ],
            blocks: [
              {
                type: "future",
                content: "x",
                topLeftX: 1,
                topLeftY: 2,
                bottomRightX: 3,
                bottomRightY: 4
              }
            ],
            confidenceScores: {
              averagePageConfidenceScore: 0.75,
              minimumPageConfidenceScore: 0.5,
              wordConfidenceScores: [
                { text: "Hello", confidence: 0.9, startIndex: 0 },
                { text: "world", confidence: 0.7, startIndex: 6 }
              ]
            }
          }
        ],
        usageInfo: { pagesProcessed: 1, docSizeBytes: 10 },
        image_url: "data:image/png;base64,abc"
      }
    });
    expect(normalized.summary.averageConfidence).toBeCloseTo(0.8);
    expect(normalized.summary.minimumConfidence).toBe(0.7);
    expect(normalized.summary.lowConfidenceWordCount).toBe(1);
    expect(normalized.pages[0]?.blocks[0]?.type).toBe("unknown");
    expect(normalized.pages[0]?.tables[0]?.html).not.toContain("onclick");
    expect(JSON.stringify(normalized.raw)).not.toContain("base64,abc");
  });

  it("does not treat missing confidence as zero", () => {
    const normalized = normalizeOcrResponse({
      requestId: "r",
      file: { name: "x.pdf", type: "application/pdf", size: 10 },
      durationMs: 1,
      model: "m",
      pageCount: 1,
      lowConfidenceThreshold: 0.8,
      upstream: {
        model: "m",
        pages: [{ index: 0, markdown: "", dimensions: null, images: [] }]
      }
    });
    expect(normalized.summary.averageConfidence).toBeNull();
    expect(normalizeBlockType("new_kind")).toEqual({
      type: "unknown",
      originalType: "new_kind"
    });
  });
});

describe("html sanitization", () => {
  it("keeps narrow table markup only", () => {
    const clean = sanitizeTableHtml(
      "<table><tr><td colspan='2' style='x'>A<script>x</script></td></tr></table>"
    );
    expect(clean).toContain('colspan="2"');
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("style");
  });
});

describe("rate and concurrency", () => {
  it("limits requests and releases concurrency slots", () => {
    resetRateLimiter();
    expect(checkRateLimit("a", 1, 0).allowed).toBe(true);
    expect(checkRateLimit("a", 1, 1).allowed).toBe(false);
    resetConcurrency();
    expect(tryAcquireSlot(1)).toBe(true);
    expect(tryAcquireSlot(1)).toBe(false);
    releaseSlot();
    expect(getActiveJobs()).toBe(0);
  });
});

describe("raw sanitization", () => {
  it("truncates huge raw payloads", () => {
    expect(
      sanitizeRaw({ items: Array.from({ length: 200 }, () => "x".repeat(4000)) }).truncated
    ).toBe(true);
  });
});
