# Mistral OCR 4 Live Lab

An interactive web lab for document OCR and layout analysis powered by **Mistral OCR 4**.
Upload a PDF or image and inspect the extracted text, rendered math, tables, blocks,
bounding boxes, and per-word confidence scores in real time.

> Independent demonstration using the Mistral API. Not an official Mistral product.

## Features

- Upload **PDF, PNG, JPG/JPEG, WebP** with client + server validation.
- **Rendered Markdown & LaTeX math** (KaTeX) preview, plus Text, Tables, Blocks,
  Confidence, and raw/normalized JSON tabs.
- **Bounding-box overlay** with clickable block selection.
- Per-word **confidence scores** and summary metrics.
- **English / Arabic** UI with full RTL support, dark/light themes, and presentation mode.
- One-click exports (Markdown, text, JSON, tables).
- Security hardening: file-signature checks, size/page limits, rate limiting, CSP,
  sanitized output, no persistent file storage.

## Quick Start (run locally)

You only need **Node.js 20+** and a **Mistral API key**.

### 1. Get a Mistral API key

Create a free key at **<https://console.mistral.ai/api-keys>**.

### 2. Clone and install

```bash
git clone https://github.com/Btr4k/mistral-ocr-lab.git
cd mistral-ocr-lab
npm install
```

### 3. Add your API key

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your key:

```
MISTRAL_API_KEY=your_key_here
```

The key is read **server-side only** — it is never exposed to the browser.

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. The status pill turns **Ready** once the key is detected.
Drop in a document and click **Run OCR**.

> If the pill shows **Not configured**, your `MISTRAL_API_KEY` is missing or empty in
> `.env.local`. Add it and restart `npm run dev`.

## Configuration

All settings live in environment variables (see `.env.example` for the full list with
inline descriptions):

| Variable | Default | Description |
| --- | --- | --- |
| `MISTRAL_API_KEY` | _(required)_ | Your Mistral API key. Server-side only. |
| `MISTRAL_OCR_MODEL` | `mistral-ocr-4-0` | OCR model id. |
| `OCR_MAX_FILE_SIZE_MB` | `10` | Max upload size. |
| `OCR_MAX_PAGES` | `15` | Max PDF pages. |
| `OCR_TIMEOUT_MS` | `180000` | OCR request timeout. |
| `OCR_MAX_CONCURRENT_JOBS` | `2` | In-flight OCR jobs allowed. |
| `OCR_RATE_LIMIT_PER_MINUTE` | `3` | OCR requests per minute per client. |
| `LOG_LEVEL` | `info` | Server log verbosity. |

Never create a `NEXT_PUBLIC_MISTRAL_API_KEY` — that would leak the key to the browser.

## Run with Docker

```bash
cp .env.example .env.production   # then edit and set MISTRAL_API_KEY
chmod 600 .env.production
docker compose up -d --build
curl --fail http://127.0.0.1:3010/api/health
```

The container binds to `127.0.0.1:3010` and runs as a non-root user. Put a reverse
proxy (Nginx, Caddy, …) in front of it for public deployments and terminate TLS there.
See [DEPLOYMENT.md](DEPLOYMENT.md) for a full self-hosting guide.

## How it works

```
Browser → Next.js (/api/ocr) → Mistral OCR API → normalize + sanitize → Browser
```

Files are previewed locally in the browser. On **Run OCR**, the file is sent to the
`/api/ocr` route, which validates it, calls Mistral OCR, normalizes the response into
app-owned types (`src/types/ocr.ts`), sanitizes table HTML, strips oversized payloads,
and returns the result with `Cache-Control: no-store`. Nothing is persisted server-side.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md) for details.

## Development

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # unit tests (vitest)
npm run test:e2e     # end-to-end tests (playwright)
npm run format       # prettier
```

## Privacy

Uploaded files are processed in memory and are **not stored** by this app. Submitted
documents are sent to the Mistral API for processing. Do not upload confidential
documents or sensitive personal information.

## Troubleshooting

- **Page loads with no styling (plain text).** Next picked the wrong workspace root
  because of a stray `package-lock.json` in a parent folder (common on Windows, e.g.
  `C:\Users\<name>\`). This repo pins the root via `turbopack.root` in
  `next.config.ts`, so just `git pull` and restart `npm run dev`. You can also delete
  the stray lockfile.
- **Status pill shows "Not configured".** `MISTRAL_API_KEY` is missing/empty in
  `.env.local`. Add it and restart.

## Known limitations

- In-memory rate limiting is single-instance only.
- No authentication in v1.
- OCR quality and confidence are provided by upstream Mistral behavior.

## License

[MIT](LICENSE)
