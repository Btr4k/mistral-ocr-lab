import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OcrLab } from "@/components/ocr-lab";

vi.mock("next/dynamic", () => ({
  default: () =>
    function MockPdf() {
      return <div>PDF preview</div>;
    }
}));

const successResult = {
  requestId: "r",
  file: { name: "sample.png", type: "image/png", size: 8 },
  processing: { durationMs: 123, model: "mistral-ocr-4-0", pageCount: 1 },
  summary: {
    blockCount: 1,
    tableCount: 1,
    imageCount: 0,
    lowConfidenceWordCount: 1,
    averageConfidence: 0.75,
    minimumConfidence: 0.7
  },
  pages: [
    {
      index: 0,
      markdown: "Hello **table**",
      text: "Hello table",
      dimensions: { width: 100, height: 100, dpi: 72 },
      blocks: [
        {
          id: "b1",
          pageIndex: 0,
          index: 0,
          type: "text",
          originalType: "text",
          content: "Hello",
          bbox: { topLeftX: 1, topLeftY: 1, bottomRightX: 20, bottomRightY: 20 },
          tableId: null,
          imageId: null,
          confidence: null
        }
      ],
      tables: [
        {
          id: "t1",
          pageIndex: 0,
          html: "<table><tr><td>A</td></tr></table>",
          markdown: null,
          confidence: null,
          wordConfidences: []
        }
      ],
      images: [],
      confidence: {
        pageAverage: 0.75,
        words: [{ text: "Hello", confidence: 0.7, pageIndex: 0 }]
      },
      header: null,
      footer: null
    }
  ],
  usage: null,
  raw: {}
};

function mockFetch() {
  global.fetch = vi.fn(async (url) => {
    if (String(url).includes("/api/health")) {
      return new Response(
        JSON.stringify({ status: "ready", configured: true, model: "m", timestamp: "now" })
      );
    }
    return new Response(JSON.stringify(successResult), { status: 200 });
  }) as typeof fetch;
}

describe("OcrLab", () => {
  it("supports English LTR, Arabic RTL, upload validation, tabs, tables, confidence, and selection", async () => {
    mockFetch();
    render(<OcrLab />);
    expect(document.documentElement.dir).toBe("ltr");
    await screen.findByText("Ready");
    await userEvent.click(screen.getByText("العربية"));
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByText("اختبار Mistral OCR 4")).toBeInTheDocument();

    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await userEvent.upload(
      input,
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "sample.png",
        { type: "image/png" }
      )
    );
    await userEvent.click(screen.getByText("تشغيل OCR"));
    await waitFor(() => expect(screen.getByText("اكتمل تحليل المستند")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("tab", { name: "الجداول المكتشفة" }));
    expect(screen.getByText(/t1/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "درجات الثقة" }));
    expect(screen.getByText("درجة الثقة ليست قياسًا مضمونًا لدقة النص.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "الكتل المكتشفة" }));
    await userEvent.click(screen.getByText("تحديد الكتلة"));
    expect(screen.getAllByText(/text/).length).toBeGreaterThan(0);
  });
});
