// Copies the pdf.js worker out of node_modules into public/ so it is served as
// a stable static asset. The filename is stamped with the installed pdfjs-dist
// version, which guarantees the worker can never drift from the API version
// react-pdf loads (a mismatch is the classic "PDF preview failed" cause) and
// busts any stale CDN cache on upgrade. Run automatically via pre(dev|build).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { version } = require("pdfjs-dist/package.json");
const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");

const publicDir = join(process.cwd(), "public");
mkdirSync(publicDir, { recursive: true });

const destination = join(publicDir, `pdf.worker.${version}.min.mjs`);
copyFileSync(source, destination);

console.log(`Copied pdf.js worker ${version} -> public/pdf.worker.${version}.min.mjs`);
