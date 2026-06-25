# Architecture

## Component Architecture

- `src/app`: Next.js App Router layout, page, and API routes.
- `src/components`: interactive upload, preview, tabs, overlays, and shared UI.
- `src/config`: env and limit parsing.
- `src/lib/mistral`: SDK adapter, input construction, normalization, and upstream errors.
- `src/lib/security`: rate limiting, concurrency, signatures, sanitization, request IDs, filenames.
- `src/types`: application-owned OCR and API contracts.

## Request Lifecycle

`POST /api/ocr` generates a request ID, validates multipart content, checks content length, validates one file, inspects PDF page count, applies rate/concurrency controls, calls Mistral, normalizes/sanitizes output, and releases the concurrency slot in `finally`.

## Mistral Adapter

The official SDK is used because its installed types expose required OCR 4 options. The adapter builds Base64 data URL document inputs and sets `includeBlocks`, `confidenceScoresGranularity: "word"`, `tableFormat: "html"`, `extractHeader`, `extractFooter`, and `includeImageBase64: false`.

## Normalization Layer

The UI never consumes SDK types directly. Unknown block types normalize to `unknown` with the original type retained. Missing confidence remains `null`. Raw payloads are recursively scrubbed and size-limited.

## Security Boundaries

The browser validates only for usability. The server is authoritative for file type, size, signature, PDF page count, rate/concurrency enforcement, OCR invocation, and response sanitization.

## Rate Limiting

The app uses an in-memory per-IP-hash limiter for a single-instance demo. Nginx adds a second per-IP limit for `/api/ocr`. This is not a distributed limiter.

## Concurrency Control

The server rejects OCR jobs above `OCR_MAX_CONCURRENT_JOBS`; there is no unbounded queue. Slots are released in `finally`.

## Deployment Architecture

Internet traffic reaches Nginx on `ocr.a8d.ai`, which proxies to `http://127.0.0.1:3010`. Docker exposes the Next.js container only on loopback.

## Trust Boundaries

Untrusted inputs include uploaded files, filenames, OCR markdown/table output, and upstream raw JSON. Secrets are trusted only inside server-side environment variables.
