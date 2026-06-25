const RESERVED = /[<>:"/\\|?*\u0000-\u001f]/g;

export function safeBaseFilename(input: string) {
  const name = input.split(/[\\/]/).pop() || "document";
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const safe = withoutExt.replace(RESERVED, "-").replace(/\s+/g, "-").replace(/-+/g, "-");
  return safe.replace(/^-|-$/g, "").slice(0, 80) || "document";
}

export function exportFilename(input: string, suffix: string, extension: string) {
  return `${safeBaseFilename(input)}-${suffix}.${extension.replace(/^\./, "")}`;
}
