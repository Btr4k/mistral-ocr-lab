export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp"
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const EXTENSION_TO_MIME: Record<string, AllowedMimeType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

export function getExtension(filename: string) {
  const clean = filename.toLowerCase();
  const last = clean.lastIndexOf(".");
  return last >= 0 ? clean.slice(last + 1) : "";
}

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(value as AllowedMimeType);
}

export function extensionMatchesMime(filename: string, mime: string) {
  const expected = EXTENSION_TO_MIME[getExtension(filename)];
  return Boolean(expected && expected === mime);
}

export function signatureMatches(buffer: Uint8Array, mime: AllowedMimeType) {
  if (mime === "application/pdf") {
    return startsWithAscii(buffer, "%PDF-");
  }
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return sig.every((byte, index) => buffer[index] === byte);
  }
  if (mime === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mime === "image/webp") {
    return startsWithAscii(buffer, "RIFF") && asciiAt(buffer, 8, 12) === "WEBP";
  }
  return false;
}

function startsWithAscii(buffer: Uint8Array, text: string) {
  return asciiAt(buffer, 0, text.length) === text;
}

function asciiAt(buffer: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...buffer.slice(start, end));
}
