import type { OCRBlock } from "@/types/ocr";

export type BoxPercent = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function blockToPercentBox(
  block: OCRBlock,
  pageWidth: number,
  pageHeight: number
): BoxPercent | null {
  if (!block.bbox || pageWidth <= 0 || pageHeight <= 0) return null;
  const { topLeftX, topLeftY, bottomRightX, bottomRightY } = block.bbox;
  if (
    !Number.isFinite(topLeftX) ||
    !Number.isFinite(topLeftY) ||
    !Number.isFinite(bottomRightX) ||
    !Number.isFinite(bottomRightY) ||
    bottomRightX <= topLeftX ||
    bottomRightY <= topLeftY
  ) {
    return null;
  }

  const left = clamp((topLeftX / pageWidth) * 100);
  const top = clamp((topLeftY / pageHeight) * 100);
  const right = clamp((bottomRightX / pageWidth) * 100);
  const bottom = clamp((bottomRightY / pageHeight) * 100);
  if (right <= left || bottom <= top) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
