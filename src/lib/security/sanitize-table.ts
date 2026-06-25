import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  "p",
  "br",
  "strong",
  "em"
];

export function sanitizeTableHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes: {
      td: ["rowspan", "colspan"],
      th: ["rowspan", "colspan"],
      col: ["span"]
    },
    allowedSchemes: [],
    allowedSchemesByTag: {},
    transformTags: {
      td: sanitizeSpanAttrs,
      th: sanitizeSpanAttrs,
      col: sanitizeSpanAttrs
    },
    disallowedTagsMode: "discard"
  });
}

function sanitizeSpanAttrs(tagName: string, attribs: Record<string, string>) {
  const clean: Record<string, string> = {};
  for (const key of ["rowspan", "colspan", "span"]) {
    const value = attribs[key];
    if (value && /^[1-9][0-9]?$/.test(value)) clean[key] = value;
  }
  return { tagName, attribs: clean };
}
