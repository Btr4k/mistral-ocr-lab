export type OCRBlockType =
  | "text"
  | "title"
  | "list"
  | "table"
  | "image"
  | "equation"
  | "caption"
  | "code"
  | "references"
  | "aside_text"
  | "header"
  | "footer"
  | "signature"
  | "unknown";

export type OCRFileInfo = {
  name: string;
  type: string;
  size: number;
};

export type OCRProcessingInfo = {
  durationMs: number;
  model: string;
  pageCount: number;
};

export type OCRSummary = {
  blockCount: number;
  tableCount: number;
  imageCount: number;
  lowConfidenceWordCount: number;
  averageConfidence: number | null;
  minimumConfidence: number | null;
};

export type OCRPageDimensions = {
  width: number;
  height: number;
  dpi: number | null;
};

export type OCRWordConfidence = {
  text: string;
  confidence: number;
  pageIndex: number;
  context?: string;
};

export type OCRConfidenceScores = {
  pageAverage: number | null;
  words: OCRWordConfidence[];
};

export type OCRBlock = {
  id: string;
  pageIndex: number;
  index: number;
  type: OCRBlockType;
  originalType: string | null;
  content: string;
  bbox: {
    topLeftX: number;
    topLeftY: number;
    bottomRightX: number;
    bottomRightY: number;
  } | null;
  tableId: string | null;
  imageId: string | null;
  confidence: number | null;
};

export type OCRTable = {
  id: string;
  pageIndex: number;
  html: string;
  markdown: string | null;
  confidence: number | null;
  wordConfidences: OCRWordConfidence[];
};

export type OCRImage = {
  id: string;
  pageIndex: number;
  bbox: OCRBlock["bbox"];
};

export type OCRHyperlink = {
  text: string;
  url: string;
};

export type OCRPage = {
  index: number;
  markdown: string;
  text: string;
  dimensions: OCRPageDimensions | null;
  blocks: OCRBlock[];
  tables: OCRTable[];
  images: OCRImage[];
  confidence: OCRConfidenceScores;
  header: string | null;
  footer: string | null;
};

export type OCRUsageInfo = {
  pagesProcessed?: number;
  documentSizeBytes?: number;
} | null;

export type OCRSanitizedRawResponse = Record<string, unknown>;

export type OCRNormalizedResponse = {
  requestId: string;
  file: OCRFileInfo;
  processing: OCRProcessingInfo;
  summary: OCRSummary;
  pages: OCRPage[];
  usage: OCRUsageInfo;
  raw: OCRSanitizedRawResponse;
};

export type OCRResult = OCRNormalizedResponse;
