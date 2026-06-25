"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eraser,
  FileText,
  Languages,
  Maximize2,
  Moon,
  Play,
  Square,
  Sun,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exportFilename } from "@/lib/security/safe-filename";
import { ALLOWED_MIME_TYPES, extensionMatchesMime } from "@/lib/security/file-signatures";
import { blockToPercentBox } from "@/lib/document/bounding-box";
import { translations, type Language, type T } from "@/lib/i18n/translations";
import type { HealthResponse, OCRApiError } from "@/types/api";
import type { OCRBlock, OCRBlockType, OCRResult } from "@/types/ocr";

const PdfPreview = dynamic(
  () => import("@/components/document/pdf-preview").then((module) => module.PdfPreview),
  { ssr: false }
);

type Tab = "preview" | "text" | "tables" | "blocks" | "confidence" | "json";

const maxFileSizeBytes = 10 * 1024 * 1024;
const maxPages = 15;

export function OcrLab() {
  const [language, setLanguage] = useState<Language>("en");
  const t = translations[language];
  const dir = language === "ar" ? "rtl" : "ltr";
  const { resolvedTheme, setTheme } = useTheme();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<number | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [serverError, setServerError] = useState<OCRApiError["error"] | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error" | "cancelled">(
    "idle"
  );
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [selectedPage, setSelectedPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [blockFilter, setBlockFilter] = useState<OCRBlockType | "all">("all");
  const [search, setSearch] = useState("");
  const [threshold, setThreshold] = useState(0.8);
  const [jsonMode, setJsonMode] = useState<"normalized" | "raw">("normalized");
  const [presentation, setPresentation] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("presentation") === "1"
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRegionRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() =>
        setHealth({
          status: "unavailable",
          configured: false,
          model: "mistral-ocr-4-0",
          timestamp: new Date().toISOString()
        })
      );
  }, []);

  useEffect(() => () => revokePreviewUrl(objectUrlRef), []);

  // Track the preview pane's inner width so the page renders to fit (zoom then
  // multiplies it), instead of its native size overflowing the panel.
  useEffect(() => {
    const node = previewContainerRef.current;
    if (!node) return;
    const update = () => setPreviewWidth(Math.max(0, node.clientWidth - 24));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fileValidation = useMemo(() => validateClientFile(file, pdfPages), [file, pdfPages]);
  const currentPage =
    result?.pages.find((page) => page.index === selectedPage) ?? result?.pages[0];
  const pageCount = result?.processing.pageCount ?? pdfPages ?? (file && !isPdf(file) ? 1 : 0);
  const canRun = Boolean(
    file && !fileValidation && health?.status === "ready" && status !== "running"
  );

  const handleFile = useCallback((nextFile: File | null) => {
    revokePreviewUrl(objectUrlRef);
    const nextUrl = nextFile ? URL.createObjectURL(nextFile) : null;
    objectUrlRef.current = nextUrl;
    setObjectUrl(nextUrl);
    setResult(null);
    setServerError(null);
    setPreviewError(null);
    setPdfPages(null);
    setSelectedPage(0);
    setSelectedBlockId(null);
    setFile(nextFile);
    setClientError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const runOcr = async () => {
    if (!file || fileValidation) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("running");
    setServerError(null);
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        body: form,
        signal: controller.signal
      });
      const data = await response.json();
      if (!response.ok) {
        setServerError((data as OCRApiError).error);
        setStatus("error");
        return;
      }
      setResult(data as OCRResult);
      setSelectedPage(0);
      setActiveTab("preview");
      setStatus("success");
      setTimeout(() => resultRegionRef.current?.focus(), 0);
    } catch {
      if (controller.signal.aborted) {
        setStatus("cancelled");
      } else {
        setStatus("error");
        setServerError({
          code: "INTERNAL_ERROR",
          message: "Request failed.",
          messageAr: "فشل الطلب.",
          requestId: "client",
          retryable: true
        });
      }
    } finally {
      abortRef.current = null;
    }
  };

  const clearAll = () => {
    abortRef.current?.abort();
    handleFile(null);
    setResult(null);
    setServerError(null);
    setStatus("idle");
  };

  const selectedBlock = useMemo(
    () =>
      result?.pages
        .flatMap((page) => page.blocks)
        .find((block) => block.id === selectedBlockId),
    [result, selectedBlockId]
  );

  const allBlocks = result?.pages.flatMap((page) => page.blocks) ?? [];
  const filteredBlocks = allBlocks.filter((block) => {
    const typeOk = blockFilter === "all" || block.type === blockFilter;
    const searchOk = !search || block.content.toLowerCase().includes(search.toLowerCase());
    return typeOk && searchOk;
  });

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden ${presentation ? "presentation" : ""}`}
      dir={dir}
    >
      <header className="shrink-0 border-b border-slate-300/80 bg-white/90 dark:border-slate-700 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <a
              href="https://a8d.ai"
              className="rounded-md text-lg font-black tracking-wide text-cyan-700 dark:text-cyan-300"
            >
              A8D.AI
            </a>
            <div>
              <p className="text-sm font-bold">{t.shortTitle}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{t.disclaimer}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={health?.status ?? "unavailable"} language={language} />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            >
              <Languages size={17} aria-hidden />
              {t.language}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              aria-label={t.theme}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setPresentation((value) => !value)}
            >
              <Maximize2 size={17} aria-hidden />
              {t.presentation}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-4">
        <section className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="text-2xl font-black tracking-normal md:text-3xl">
              {t.productTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.subtitle}</p>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{t.privacy}</span>{" "}
            {t.retention} {t.apiNotice}
          </p>
        </section>

        <section className="panel mb-3 shrink-0 p-3">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            onChange={(event) => handleFile(event.target.files?.item(0) ?? null)}
          />
          {!file ? (
            <div
              role="button"
              tabIndex={0}
              aria-label={t.drop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dropped = event.dataTransfer.files.item(0);
                if (event.dataTransfer.files.length > 1) {
                  setClientError(translations[language].drop);
                  return;
                }
                handleFile(dropped);
              }}
              className="flex cursor-pointer flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-md border-2 border-dashed border-cyan-600/70 bg-cyan-50/60 px-4 py-5 text-center dark:bg-cyan-950/30"
            >
              <FileText size={24} aria-hidden className="text-cyan-700 dark:text-cyan-300" />
              <p className="font-bold">{t.drop}</p>
              <span className="btn btn-secondary">{t.choose}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t.supported} · 10 MB · {maxPages} {t.pages}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText
                  size={22}
                  aria-hidden
                  className="shrink-0 text-cyan-700 dark:text-cyan-300"
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{truncate(file.name, 48)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {file.type || t.unavailable} · {formatBytes(file.size)}
                    {pdfPages
                      ? ` · ${pdfPages} ${t.pages}`
                      : file.type.startsWith("image/")
                        ? ` · 1 ${t.pages}`
                        : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {status === "running" ? (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                  >
                    <Square size={17} aria-hidden />
                    {t.cancel}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!canRun}
                    onClick={runOcr}
                  >
                    <Play size={17} aria-hidden />
                    {t.run}
                  </button>
                )}
                <button className="btn btn-secondary" type="button" onClick={clearAll}>
                  <Eraser size={17} aria-hidden />
                  {t.clear}
                </button>
              </div>
            </div>
          )}
          {(fileValidation || clientError || status !== "idle" || serverError) && (
            <div aria-live="polite" className="mt-2 text-sm">
              {(fileValidation || clientError) && (
                <p className="text-red-700 dark:text-red-300" role="alert">
                  {fileValidation || clientError}
                </p>
              )}
              {status === "running" && <p>{t.loading}</p>}
              {status === "success" && (
                <p className="text-emerald-700 dark:text-emerald-300">{t.complete}</p>
              )}
              {status === "error" && (
                <p className="text-red-700 dark:text-red-300">{t.failed}</p>
              )}
              {serverError && (
                <p className="text-red-700 dark:text-red-300">
                  {language === "ar" ? serverError.messageAr : serverError.message} (
                  {serverError.code})
                </p>
              )}
            </div>
          )}
        </section>

        {result && <Summary result={result} t={t} />}

        <section
          ref={resultRegionRef}
          tabIndex={-1}
          className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2"
          aria-label="OCR workspace"
        >
          <div className="panel flex min-h-0 flex-col overflow-hidden p-4">
            <PanelHeader title={t.original}>
              <PageControls
                page={selectedPage}
                total={pageCount}
                onPrev={() => setSelectedPage((page) => Math.max(0, page - 1))}
                onNext={() =>
                  setSelectedPage((page) => Math.min(Math.max(0, pageCount - 1), page + 1))
                }
                label={t.page}
              />
            </PanelHeader>
            <div className="mb-3 flex shrink-0 flex-wrap gap-2">
              <IconButton
                label={t.zoomIn}
                onClick={() => setZoom((value) => Math.min(2.5, value + 0.15))}
              >
                <ZoomIn size={16} />
              </IconButton>
              <IconButton
                label={t.zoomOut}
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.15))}
              >
                <ZoomOut size={16} />
              </IconButton>
              <button className="btn btn-secondary" type="button" onClick={() => setZoom(1)}>
                {t.resetZoom}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowBoxes((v) => !v)}
              >
                {showBoxes ? t.hideBoxes : t.showBoxes}
              </button>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowLabels((v) => !v)}
              >
                {showLabels ? t.hideLabels : t.showLabels}
              </button>
            </div>
            <div
              ref={previewContainerRef}
              className="min-h-0 flex-1 overflow-auto rounded-md bg-slate-100 p-3 dark:bg-slate-900"
            >
              {!file ? (
                <div className="flex h-full items-center justify-center">
                  <EmptyState text={t.drop} />
                </div>
              ) : (
                <div className="relative mx-auto w-fit">
                  {objectUrl && isPdf(file) && previewWidth > 0 && (
                    <PdfPreview
                      url={objectUrl}
                      page={selectedPage + 1}
                      width={Math.round(previewWidth * zoom)}
                      onPageCount={setPdfPages}
                      onError={setPreviewError}
                    />
                  )}
                  {objectUrl && file.type.startsWith("image/") && previewWidth > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={objectUrl}
                      alt={t.original}
                      className="block h-auto max-w-none"
                      style={{ width: Math.round(previewWidth * zoom) }}
                      onLoad={() => setPdfPages(1)}
                    />
                  )}
                  {showBoxes && currentPage?.dimensions && (
                    <BoundingBoxes
                      blocks={currentPage.blocks}
                      pageWidth={currentPage.dimensions.width}
                      pageHeight={currentPage.dimensions.height}
                      selectedBlockId={selectedBlockId}
                      showLabels={showLabels}
                      onSelect={(block) => {
                        setSelectedBlockId(block.id);
                        setSelectedPage(block.pageIndex);
                      }}
                    />
                  )}
                </div>
              )}
              {previewError && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-300">{previewError}</p>
              )}
            </div>
          </div>

          <div className="panel flex min-h-0 flex-col overflow-hidden p-4">
            <PanelHeader title={t.result}>
              {result && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() =>
                    downloadJson(result, exportFilename(result.file.name, "ocr", "json"))
                  }
                >
                  <Download size={16} aria-hidden />
                  {t.download}
                </button>
              )}
            </PanelHeader>
            {result ? (
              <>
                <Tabs activeTab={activeTab} setActiveTab={setActiveTab} t={t} />
                <div className="mt-4 min-h-0 flex-1 overflow-auto">
                  {activeTab === "preview" && (
                    <PreviewTab result={result} selectedPage={selectedPage} t={t} />
                  )}
                  {activeTab === "text" && (
                    <TextTab
                      result={result}
                      selectedPage={selectedPage}
                      search={search}
                      setSearch={setSearch}
                      t={t}
                    />
                  )}
                  {activeTab === "tables" && <TablesTab result={result} t={t} />}
                  {activeTab === "blocks" && (
                    <BlocksTab
                      blocks={filteredBlocks}
                      allBlocks={allBlocks}
                      filter={blockFilter}
                      setFilter={setBlockFilter}
                      search={search}
                      setSearch={setSearch}
                      selectedBlockId={selectedBlockId}
                      onSelect={(block) => {
                        setSelectedBlockId(block.id);
                        setSelectedPage(block.pageIndex);
                      }}
                      t={t}
                    />
                  )}
                  {activeTab === "confidence" && (
                    <ConfidenceTab
                      result={result}
                      threshold={threshold}
                      setThreshold={setThreshold}
                      search={search}
                      setSearch={setSearch}
                      t={t}
                    />
                  )}
                  {activeTab === "json" && (
                    <JsonTab result={result} mode={jsonMode} setMode={setJsonMode} t={t} />
                  )}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <EmptyState text={status === "running" ? t.loading : t.result} />
              </div>
            )}
            {selectedBlock && (
              <p className="mt-3 rounded-md bg-cyan-50 p-2 text-sm dark:bg-cyan-950">
                {t.selectBlock}: {selectedBlock.type} · {truncate(selectedBlock.content, 100)}
              </p>
            )}
          </div>
        </section>
      </main>
      {!presentation && (
        <footer className="mx-auto w-full max-w-7xl shrink-0 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
          <a href="https://a8d.ai" rel="noopener noreferrer">
            {t.builtBy}
          </a>
        </footer>
      )}
    </div>
  );
}

function StatusPill({
  status,
  language
}: {
  status: HealthResponse["status"];
  language: Language;
}) {
  const t = translations[language];
  const label =
    status === "ready"
      ? t.ready
      : status === "not_configured"
        ? t.notConfigured
        : t.apiUnavailable;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">
      {status === "ready" ? (
        <CheckCircle2 className="text-emerald-600" size={16} />
      ) : (
        <AlertTriangle className="text-amber-600" size={16} />
      )}
      {label}
    </span>
  );
}

function Summary({ result, t }: { result: OCRResult; t: T }) {
  const pct = (value: number | null) =>
    value === null ? t.unavailable : `${Math.round(value * 100)}%`;
  const cards = [
    [t.pages, result.processing.pageCount],
    [t.duration, formatDuration(result.processing.durationMs)],
    [t.blocks, result.summary.blockCount],
    [t.tables, result.summary.tableCount],
    [t.images, result.summary.imageCount],
    [t.avgConfidence, pct(result.summary.averageConfidence)],
    [t.minConfidence, pct(result.summary.minimumConfidence)],
    [t.lowWords, result.summary.lowConfidenceWordCount]
  ];
  return (
    <section className="mb-3 grid shrink-0 grid-cols-4 gap-2 md:grid-cols-8">
      {cards.map(([label, value]) => (
        <div className="panel px-3 py-2" key={label}>
          <p
            className="truncate text-[11px] text-slate-600 dark:text-slate-300"
            title={String(label)}
          >
            {label}
          </p>
          <p className="mt-0.5 text-lg font-black leading-tight">{value}</p>
        </div>
      ))}
    </section>
  );
}

function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PageControls({
  page,
  total,
  onPrev,
  onNext,
  label
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  if (!total) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <button className="btn btn-secondary" type="button" onClick={onPrev} disabled={page <= 0}>
        ‹
      </button>
      <span>
        {label} {page + 1}/{total}
      </span>
      <button
        className="btn btn-secondary"
        type="button"
        onClick={onNext}
        disabled={page >= total - 1}
      >
        ›
      </button>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="btn btn-secondary"
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BoundingBoxes({
  blocks,
  pageWidth,
  pageHeight,
  selectedBlockId,
  showLabels,
  onSelect
}: {
  blocks: OCRBlock[];
  pageWidth: number;
  pageHeight: number;
  selectedBlockId: string | null;
  showLabels: boolean;
  onSelect: (block: OCRBlock) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {blocks.map((block) => {
        const box = blockToPercentBox(block, pageWidth, pageHeight);
        if (!box) return null;
        return (
          <button
            key={block.id}
            type="button"
            className={`pointer-events-auto absolute border-2 bg-cyan-400/10 text-left ${
              selectedBlockId === block.id ? "border-cyan-500" : "border-cyan-600/70"
            }`}
            style={{
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              height: `${box.height}%`
            }}
            onClick={() => onSelect(block)}
            aria-label={`${block.type} block`}
          >
            {showLabels && (
              <span className="absolute left-0 top-0 rounded-br bg-cyan-700 px-1 text-[10px] font-bold text-white">
                {block.type}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Tabs({
  activeTab,
  setActiveTab,
  t
}: {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  t: T;
}) {
  const tabs: [Tab, string][] = [
    ["preview", t.preview],
    ["text", t.text],
    ["tables", t.tables],
    ["blocks", t.blocks],
    ["confidence", t.confidence],
    ["json", t.json]
  ];
  return (
    <div
      className="flex flex-wrap gap-1 border-b border-slate-300 dark:border-slate-700"
      role="tablist"
    >
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`tab-${tab}`}
          className={`rounded-t-md px-3 py-2 text-sm font-bold ${
            activeTab === tab
              ? "bg-cyan-100 text-cyan-950 dark:bg-cyan-900 dark:text-cyan-50"
              : ""
          }`}
          type="button"
          onClick={() => setActiveTab(tab)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PreviewTab({
  result,
  selectedPage,
  t
}: {
  result: OCRResult;
  selectedPage: number;
  t: T;
}) {
  const markdown =
    result.pages.find((page) => page.index === selectedPage)?.markdown ||
    joinPages(result, "markdown");
  return (
    <section id="tab-preview" role="tabpanel" className="flex h-full min-h-0 flex-col">
      <ActionRow
        onCopy={() => navigator.clipboard.writeText(markdown)}
        onDownload={() =>
          downloadText(markdown, exportFilename(result.file.name, "ocr", "md"), "text/markdown")
        }
        t={t}
      />
      <div className="prose-safe min-h-0 flex-1 overflow-auto rounded-md border border-slate-300 p-3 dark:border-slate-700">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: "#b91c1c" }]]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
            img: () => <span>[image omitted]</span>
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{t.safeLinks}</p>
    </section>
  );
}

function TextTab({
  result,
  selectedPage,
  search,
  setSearch,
  t
}: {
  result: OCRResult;
  selectedPage: number;
  search: string;
  setSearch: (value: string) => void;
  t: T;
}) {
  const text =
    result.pages.find((page) => page.index === selectedPage)?.text || joinPages(result, "text");
  const count = search ? text.toLowerCase().split(search.toLowerCase()).length - 1 : 0;
  return (
    <section id="tab-text" role="tabpanel">
      <SearchBox value={search} setValue={setSearch} label={t.search} />
      <p className="mb-2 text-sm">{search ? `${count} ${t.search}` : ""}</p>
      <ActionRow
        onCopy={() => navigator.clipboard.writeText(text)}
        onDownload={() =>
          downloadText(text, exportFilename(result.file.name, "ocr", "txt"), "text/plain")
        }
        t={t}
      />
      <pre className="max-h-[570px] overflow-auto whitespace-pre-wrap rounded-md border border-slate-300 p-3 text-sm dark:border-slate-700">
        {text || t.unavailable}
      </pre>
    </section>
  );
}

function TablesTab({ result, t }: { result: OCRResult; t: T }) {
  const tables = result.pages.flatMap((page) => page.tables);
  if (!tables.length) return <EmptyState text={t.noTables} />;
  return (
    <section id="tab-tables" role="tabpanel" className="space-y-3">
      {tables.map((table, index) => (
        <article
          key={table.id}
          className="rounded-md border border-slate-300 p-3 dark:border-slate-700"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">
              {t.page} {table.pageIndex + 1} · {table.id}
            </h3>
            <ActionRow
              onCopy={() => navigator.clipboard.writeText(table.html || table.markdown || "")}
              onDownload={() =>
                downloadText(
                  table.html || table.markdown || "",
                  exportFilename(
                    result.file.name,
                    `page-${table.pageIndex + 1}-table-${index + 1}`,
                    "html"
                  ),
                  "text/html"
                )
              }
              t={t}
            />
          </div>
          {table.html ? (
            <div
              className="prose-safe overflow-auto"
              dangerouslySetInnerHTML={{ __html: table.html }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm">{table.markdown}</pre>
          )}
        </article>
      ))}
    </section>
  );
}

function BlocksTab({
  blocks,
  allBlocks,
  filter,
  setFilter,
  search,
  setSearch,
  selectedBlockId,
  onSelect,
  t
}: {
  blocks: OCRBlock[];
  allBlocks: OCRBlock[];
  filter: OCRBlockType | "all";
  setFilter: (value: OCRBlockType | "all") => void;
  search: string;
  setSearch: (value: string) => void;
  selectedBlockId: string | null;
  onSelect: (block: OCRBlock) => void;
  t: T;
}) {
  const types = Array.from(new Set(allBlocks.map((block) => block.type))).sort();
  return (
    <section id="tab-blocks" role="tabpanel">
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className="rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-700"
          value={filter}
          onChange={(event) => setFilter(event.target.value as OCRBlockType | "all")}
          aria-label="Block type"
        >
          <option value="all">All</option>
          {types.map((type) => (
            <option value={type} key={type}>
              {type}
            </option>
          ))}
        </select>
        <SearchBox value={search} setValue={setSearch} label={t.search} />
      </div>
      <div className="max-h-[590px] space-y-2 overflow-auto">
        {blocks.map((block) => (
          <article
            key={block.id}
            className={`rounded-md border p-3 text-sm ${
              selectedBlockId === block.id
                ? "border-cyan-600 bg-cyan-50 dark:bg-cyan-950"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong>
                {block.type} · {t.page} {block.pageIndex + 1} · #{block.index + 1}
              </strong>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => onSelect(block)}
              >
                {t.selectBlock}
              </button>
            </div>
            <p className="whitespace-pre-wrap">{block.content || t.unavailable}</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {block.bbox
                ? `${block.bbox.topLeftX}, ${block.bbox.topLeftY}, ${block.bbox.bottomRightX}, ${block.bbox.bottomRightY}`
                : t.unavailable}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ConfidenceTab({
  result,
  threshold,
  setThreshold,
  search,
  setSearch,
  t
}: {
  result: OCRResult;
  threshold: number;
  setThreshold: (value: number) => void;
  search: string;
  setSearch: (value: string) => void;
  t: T;
}) {
  const words = result.pages.flatMap((page) => page.confidence.words);
  const filtered = words.filter(
    (word) => !search || word.text.toLowerCase().includes(search.toLowerCase())
  );
  const low = words.filter((word) => word.confidence < threshold).length;
  return (
    <section id="tab-confidence" role="tabpanel">
      <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        {t.confidenceNotice}
      </p>
      <label className="mb-3 block text-sm font-bold">
        {t.threshold}: {formatConfidence(threshold, t.unavailable)}
        <input
          className="mt-2 block w-full"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
        />
      </label>
      <SearchBox value={search} setValue={setSearch} label={t.search} />
      <p className="my-2 text-sm">
        {t.lowWords}: {low}
      </p>
      <div className="max-h-[520px] overflow-auto">
        {filtered.map((word, index) => (
          <div
            key={`${word.pageIndex}-${index}-${word.text}`}
            className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-200 py-2 text-sm dark:border-slate-800"
          >
            <span>{word.text}</span>
            <span>{formatConfidence(word.confidence, t.unavailable)}</span>
            <span>{confidenceCategory(word.confidence)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function JsonTab({
  result,
  mode,
  setMode,
  t
}: {
  result: OCRResult;
  mode: "normalized" | "raw";
  setMode: (mode: "normalized" | "raw") => void;
  t: T;
}) {
  const value = mode === "normalized" ? result : result.raw;
  const text = JSON.stringify(value, null, 2);
  return (
    <section id="tab-json" role="tabpanel">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setMode("normalized")}
        >
          {t.normalized}
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setMode("raw")}>
          {t.raw}
        </button>
        <ActionRow
          onCopy={() => navigator.clipboard.writeText(text)}
          onDownload={() =>
            downloadText(
              text,
              exportFilename(result.file.name, `ocr-${mode}`, "json"),
              "application/json"
            )
          }
          t={t}
        />
      </div>
      <pre className="max-h-[590px] overflow-auto rounded-md border border-slate-300 p-3 text-xs dark:border-slate-700">
        {text}
      </pre>
    </section>
  );
}

function ActionRow({
  onCopy,
  onDownload,
  t
}: {
  onCopy: () => void;
  onDownload: () => void;
  t: T;
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      <button className="btn btn-secondary" type="button" onClick={onCopy}>
        <Copy size={16} aria-hidden />
        {t.copy}
      </button>
      <button className="btn btn-secondary" type="button" onClick={onDownload}>
        <Download size={16} aria-hidden />
        {t.download}
      </button>
    </div>
  );
}

function SearchBox({
  value,
  setValue,
  label
}: {
  value: string;
  setValue: (value: string) => void;
  label: string;
}) {
  return (
    <label className="mb-2 block text-sm font-bold">
      {label}
      <input
        className="mt-1 block w-full rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-700"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-slate-300 p-6 text-center text-slate-600 dark:border-slate-700 dark:text-slate-300">
      {text}
    </div>
  );
}

function validateClientFile(file: File | null, pages: number | null) {
  if (!file) return null;
  if (!ALLOWED_MIME_TYPES.includes(file.type as never)) return "Unsupported file type.";
  if (!extensionMatchesMime(file.name, file.type))
    return "File extension does not match the MIME type.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxFileSizeBytes) return "The file exceeds the 10 MB limit.";
  if (pages && pages > maxPages) return "The PDF exceeds the page limit.";
  return null;
}

function revokePreviewUrl(ref: React.MutableRefObject<string | null>) {
  if (ref.current) URL.revokeObjectURL(ref.current);
  ref.current = null;
}

function isPdf(file: File) {
  return file.type === "application/pdf";
}

function joinPages(result: OCRResult, key: "markdown" | "text") {
  return result.pages
    .map((page) => `# Page ${page.index + 1}\n\n${page[key]}`)
    .join("\n\n---\n\n");
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function formatConfidence(value: number | null, fallback: string) {
  return value === null ? fallback : `${Math.round(value * 100)}% confidence`;
}

function confidenceCategory(value: number) {
  if (value >= 0.9) return "High";
  if (value >= 0.8) return "Medium";
  return "Low";
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function downloadText(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(value: unknown, filename: string) {
  downloadText(JSON.stringify(value, null, 2), filename, "application/json");
}
