import { expect, test } from "@playwright/test";

test("complete mocked OCR flow", async ({ page }) => {
  await page.route("**/api/health", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        configured: true,
        model: "mistral-ocr-4-0",
        timestamp: new Date().toISOString()
      })
    });
  });
  await page.route("**/api/ocr", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        requestId: "e2e",
        file: { name: "fixture.png", type: "image/png", size: 8 },
        processing: { durationMs: 120, model: "mistral-ocr-4-0", pageCount: 1 },
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
            markdown: "Extracted invoice text",
            text: "Extracted invoice text",
            dimensions: { width: 100, height: 100, dpi: 72 },
            blocks: [
              {
                id: "b1",
                pageIndex: 0,
                index: 0,
                type: "text",
                originalType: "text",
                content: "Extracted invoice text",
                bbox: { topLeftX: 1, topLeftY: 1, bottomRightX: 50, bottomRightY: 20 },
                tableId: null,
                imageId: null,
                confidence: null
              }
            ],
            tables: [
              {
                id: "table-1",
                pageIndex: 0,
                html: "<table><tr><td>Total</td></tr></table>",
                markdown: null,
                confidence: null,
                wordConfidences: []
              }
            ],
            images: [],
            confidence: {
              pageAverage: 0.75,
              words: [{ text: "Extracted", confidence: 0.7, pageIndex: 0 }]
            },
            header: null,
            footer: null
          }
        ],
        usage: null,
        raw: {}
      })
    });
  });

  await page.goto("/");
  await expect(page.getByText("Mistral OCR 4 Live Lab").first()).toBeVisible();
  await expect(page.getByText("Ready")).toBeVisible();
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await page.setInputFiles("input[type=file]", {
    name: "fixture.png",
    mimeType: "image/png",
    buffer: png
  });
  await page.getByRole("button", { name: /Run OCR/ }).click();
  await expect(page.getByText("Document analysis complete")).toBeVisible();
  await expect(page.getByText("Extracted invoice text")).toBeVisible();
  await page.getByRole("tab", { name: "Tables" }).click();
  await expect(page.getByText("table-1")).toBeVisible();
  await page.getByRole("tab", { name: "Blocks" }).click();
  await page.getByRole("button", { name: "Select block" }).click();
  await page.getByRole("tab", { name: "Confidence" }).click();
  await expect(
    page.getByText("Confidence is not a guaranteed measure of text accuracy.")
  ).toBeVisible();
  await page.getByRole("tab", { name: "JSON" }).click();
  await expect(page.getByText('"requestId": "e2e"')).toBeVisible();
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("button", { name: /وضع العرض/ }).click();
  await expect(page.locator(".presentation")).toBeVisible();
  await page.getByRole("button", { name: /مسح الملف/ }).click();
  await expect(
    page.getByRole("button", { name: "اسحب الملف هنا أو اختره من جهازك" })
  ).toBeVisible();
});
