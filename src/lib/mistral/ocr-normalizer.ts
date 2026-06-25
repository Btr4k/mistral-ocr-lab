import { sanitizeTableHtml } from "@/lib/security/sanitize-table";
import type {
  OCRBlock,
  OCRBlockType,
  OCRNormalizedResponse,
  OCRPage,
  OCRTable,
  OCRUsageInfo,
  OCRWordConfidence
} from "@/types/ocr";

const knownBlockTypes = new Set<OCRBlockType>([
  "text",
  "title",
  "list",
  "table",
  "image",
  "equation",
  "caption",
  "code",
  "references",
  "aside_text",
  "header",
  "footer",
  "signature",
  "unknown"
]);

const MAX_RAW_BYTES = 200_000;

type NormalizeInput = {
  requestId: string;
  file: { name: string; type: string; size: number };
  durationMs: number;
  model: string;
  pageCount: number;
  upstream: unknown;
  lowConfidenceThreshold: number;
};

export function normalizeOcrResponse(input: NormalizeInput): OCRNormalizedResponse {
  const source = asRecord(input.upstream);
  const rawPages = Array.isArray(source.pages) ? source.pages : [];
  const pages: OCRPage[] = rawPages.map((page, pagePosition) =>
    normalizePage(page, pagePosition)
  );
  const words = pages.flatMap((page) => page.confidence.words);
  const confidenceValues = words.map((word) => word.confidence).filter(Number.isFinite);
  const blockCount = pages.reduce((sum, page) => sum + page.blocks.length, 0);
  const tableCount = pages.reduce((sum, page) => sum + page.tables.length, 0);
  const imageCount = pages.reduce((sum, page) => sum + page.images.length, 0);
  const averageConfidence =
    confidenceValues.length > 0
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : null;
  const minimumConfidence = confidenceValues.length > 0 ? Math.min(...confidenceValues) : null;

  return {
    requestId: input.requestId,
    file: input.file,
    processing: {
      durationMs: input.durationMs,
      model: stringOr(source.model, input.model),
      pageCount: input.pageCount || pages.length
    },
    summary: {
      blockCount,
      tableCount,
      imageCount,
      lowConfidenceWordCount: words.filter(
        (word) => word.confidence < input.lowConfidenceThreshold
      ).length,
      averageConfidence,
      minimumConfidence
    },
    pages,
    usage: normalizeUsage(source.usageInfo ?? source.usage_info),
    raw: sanitizeRaw(source)
  };
}

export function normalizeBlockType(value: unknown): {
  type: OCRBlockType;
  originalType: string | null;
} {
  const originalType = typeof value === "string" ? value : null;
  if (originalType && knownBlockTypes.has(originalType as OCRBlockType)) {
    return { type: originalType as OCRBlockType, originalType };
  }
  return { type: "unknown", originalType };
}

function normalizePage(pageUnknown: unknown, pagePosition: number): OCRPage {
  const page = asRecord(pageUnknown);
  const index = numberOr(page.index, pagePosition);
  const markdown = stringOr(page.markdown, "");
  const confidenceSource = asRecord(page.confidenceScores ?? page.confidence_scores);
  const rawWordScores =
    confidenceSource.wordConfidenceScores ?? confidenceSource.word_confidence_scores;
  const wordScores: unknown[] = Array.isArray(rawWordScores) ? rawWordScores : [];
  const words = wordScores.map((word) => normalizeWord(word, index, markdown)).filter(Boolean);
  const blocks = (Array.isArray(page.blocks) ? page.blocks : []).map((block, blockIndex) =>
    normalizeBlock(block, index, blockIndex)
  );
  const tables = (Array.isArray(page.tables) ? page.tables : []).map((table, tableIndex) =>
    normalizeTable(table, index, tableIndex)
  );
  const images = (Array.isArray(page.images) ? page.images : []).map((image, imageIndex) => {
    const record = asRecord(image);
    return {
      id: stringOr(record.id, `page-${index}-image-${imageIndex + 1}`),
      pageIndex: index,
      bbox: null
    };
  });

  return {
    index,
    markdown,
    text: markdownToText(markdown),
    dimensions: normalizeDimensions(page.dimensions),
    blocks,
    tables,
    images,
    confidence: {
      pageAverage: finiteOrNull(
        confidenceSource.averagePageConfidenceScore ??
          confidenceSource.average_page_confidence_score
      ),
      words: words.filter(isWordConfidence)
    },
    header: stringOrNull(page.header),
    footer: stringOrNull(page.footer)
  };
}

function normalizeBlock(blockUnknown: unknown, pageIndex: number, index: number): OCRBlock {
  const block = asRecord(blockUnknown);
  const { type, originalType } = normalizeBlockType(block.type);
  const bbox =
    allFinite(block.topLeftX, block.topLeftY, block.bottomRightX, block.bottomRightY) ||
    allFinite(block.top_left_x, block.top_left_y, block.bottom_right_x, block.bottom_right_y)
      ? {
          topLeftX: numberOr(block.topLeftX ?? block.top_left_x, 0),
          topLeftY: numberOr(block.topLeftY ?? block.top_left_y, 0),
          bottomRightX: numberOr(block.bottomRightX ?? block.bottom_right_x, 0),
          bottomRightY: numberOr(block.bottomRightY ?? block.bottom_right_y, 0)
        }
      : null;
  return {
    id: `page-${pageIndex}-block-${index}`,
    pageIndex,
    index,
    type,
    originalType,
    content: stringOr(block.content, ""),
    bbox,
    tableId: stringOrNull(block.tableId ?? block.table_id),
    imageId: stringOrNull(block.imageId ?? block.image_id),
    confidence: finiteOrNull(block.confidence)
  };
}

function normalizeTable(tableUnknown: unknown, pageIndex: number, index: number): OCRTable {
  const table = asRecord(tableUnknown);
  const content = stringOr(table.content, "");
  const html = table.format === "markdown" ? "" : sanitizeTableHtml(content);
  const rawWords = table.wordConfidenceScores ?? table.word_confidence_scores;
  const words = (Array.isArray(rawWords) ? rawWords : [])
    .map((word: unknown) => normalizeWord(word, pageIndex, content))
    .filter(Boolean);
  return {
    id: stringOr(table.id, `page-${pageIndex}-table-${index + 1}`),
    pageIndex,
    html,
    markdown: table.format === "markdown" ? content : null,
    confidence: null,
    wordConfidences: words as OCRWordConfidence[]
  };
}

function normalizeWord(
  wordUnknown: unknown,
  pageIndex: number,
  contextText: string
): OCRWordConfidence | null {
  const word = asRecord(wordUnknown);
  const text = stringOr(word.text, "");
  const confidence = finiteOrNull(word.confidence);
  if (!text || confidence === null) return null;
  const start = numberOr(word.startIndex ?? word.start_index, -1);
  const context =
    start >= 0
      ? contextText.slice(Math.max(0, start - 24), Math.min(contextText.length, start + 48))
      : "";
  return { text, confidence, pageIndex, context };
}

function isWordConfidence(value: OCRWordConfidence | null): value is OCRWordConfidence {
  return value !== null;
}

function normalizeDimensions(value: unknown) {
  const dims = asRecord(value);
  const width = finiteOrNull(dims.width);
  const height = finiteOrNull(dims.height);
  if (!width || !height) return null;
  return {
    width,
    height,
    dpi: finiteOrNull(dims.dpi)
  };
}

function normalizeUsage(value: unknown): OCRUsageInfo {
  const usage = asRecord(value);
  if (!Object.keys(usage).length) return null;
  return {
    pagesProcessed: optionalNumber(usage.pagesProcessed ?? usage.pages_processed),
    documentSizeBytes: optionalNumber(usage.docSizeBytes ?? usage.doc_size_bytes)
  };
}

export function sanitizeRaw(value: unknown): Record<string, unknown> {
  const scrubbed = scrub(value);
  const json = JSON.stringify(scrubbed);
  if (json.length > MAX_RAW_BYTES) {
    return {
      truncated: true,
      reason: "Sanitized raw response exceeded browser-safe display size.",
      approximateBytes: json.length
    };
  }
  return scrubbed as Record<string, unknown>;
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 200).map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        lower.includes("authorization") ||
        lower.includes("api_key") ||
        lower.includes("apikey") ||
        lower.includes("base64") ||
        lower.includes("image_url") ||
        lower.includes("document_url")
      ) {
        out[key] = "[redacted]";
      } else {
        out[key] = scrub(nested);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > 4000)
    return `${value.slice(0, 4000)}...[truncated]`;
  return value;
}

function markdownToText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "[image omitted]")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function finiteOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function allFinite(...values: unknown[]) {
  return values.every((value) => typeof value === "number" && Number.isFinite(value));
}
