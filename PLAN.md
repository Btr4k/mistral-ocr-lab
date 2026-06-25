# Mistral OCR 4 Live Lab Plan

## Project Goals

- Build a production-ready Next.js App Router application for A8D.AI at `https://ocr.a8d.ai`.
- Let users upload one PDF, PNG, JPG/JPEG, or WebP document, preview it locally, submit it to Mistral OCR 4, and inspect extracted markdown, text, tables, blocks, bounding boxes, confidence scores, and normalized JSON.
- Keep secrets server-side, avoid permanent file retention, and ship deployment-ready Docker, Nginx, documentation, and validation scripts.

## User Flow

1. Load the app and check `GET /api/health`.
2. Select or drag one supported file.
3. Validate the file locally and preview it without uploading.
4. Click `Run OCR`.
5. Submit `multipart/form-data` to `POST /api/ocr`.
6. Server validates content type, size, extension, MIME consistency, signature, and PDF page count.
7. Server calls Mistral OCR 4 with block extraction, word confidence, HTML tables, header/footer extraction, and no image Base64.
8. Server normalizes and sanitizes the response.
9. Client displays original document and OCR results side by side, including exports and reset.

## Architecture

- Next.js App Router, TypeScript strict mode, React, Tailwind CSS.
- API routes:
  - `GET /api/health` returns non-sensitive readiness state.
  - `POST /api/ocr` performs validation, rate limiting, concurrency control, OCR, normalization, and safe errors.
- Server integration layer under `src/lib/mistral`.
- Security helpers under `src/lib/security` and validation helpers under `src/lib/validation`.
- Application-owned OCR types under `src/types`.
- Client UI composed from small components and hooks; no database, public storage, custom server, or auth in v1.

## Technical Decisions

- Official docs confirmed the OCR REST endpoint is `POST /v1/ocr` and supports `include_blocks`, `confidence_scores_granularity`, `table_format`, `extract_header`, `extract_footer`, and `include_image_base64`.
- Official Mistral TypeScript examples use SDK camelCase for some fields, while the API schema documents snake_case request fields. The installed SDK types will be inspected before finalizing the adapter.
- If SDK types do not expose all required current OCR 4 options, a narrow typed REST adapter will be used and isolated in `src/lib/mistral/ocr-client.ts`.
- Mistral docs support Base64 PDF and Base64 image inputs; no public URL or public storage will be used.
- Next.js route handlers will use the Node.js runtime and Web Request APIs.

## Implementation Phases

1. Create planning docs, repository hygiene files, and package configuration.
2. Scaffold Next.js app shell with metadata, themes, i18n, and security headers.
3. Implement server env/limits, validation, rate limiting, concurrency, logging, OCR adapter, normalization, sanitization, and API routes.
4. Implement upload flow, local preview, PDF/image rendering, bounding boxes, result tabs, exports, cancellation, and presentation mode.
5. Add unit, API, component, and Playwright tests with mocks only.
6. Add Docker, Compose, Nginx configs, deployment scripts, operations docs, and security docs.
7. Run validation commands, fix failures, build Docker image, run local container health check, and perform browser verification.
8. Write `SECURITY_REVIEW.md` and final report.

## Security Risks

- API key exposure to client bundles or logs.
- Malicious uploads, MIME spoofing, malformed/encrypted PDFs, and large payloads.
- XSS through OCR markdown/table output.
- Abuse and cost exhaustion through repeated OCR requests.
- Concurrency slot leaks on errors or cancellation.
- Raw upstream response containing Base64 or oversized data.
- Overly permissive CSP, public container ports, or unsafe Docker settings.

## Testing Strategy

- Unit tests for env parsing, validation, signatures, PDF limits, safe filenames, bounding boxes, confidence summaries, normalization, sanitization, rate limiting, concurrency, and raw response sanitization.
- API route tests for malformed requests, file errors, missing config, mocked success, upstream failures, rate/concurrency rejection, headers, and sanitized output.
- Component tests for upload validation, Arabic RTL, English LTR, tabs, empty states, confidence notice, and practical block selection behavior.
- One Playwright E2E test with mocked health and OCR endpoints. Automated tests must never call the real Mistral API.
- Optional manual smoke test only with `MISTRAL_API_KEY` and an explicit local file path.

## Deployment Strategy

- Multi-stage Docker build with standalone Next output, non-root runtime user, loopback-only host bind `127.0.0.1:3010:3000`, health checks, log rotation, and no env files in the image.
- Nginx terminates public HTTP/HTTPS for `ocr.a8d.ai` and proxies to `http://127.0.0.1:3010`.
- DNS A record: `ocr -> <YOUR_SERVER_IP>`, TTL 300.
- Certbot only after DNS resolves.
- Deployment scripts operate only on this project and avoid pruning or modifying unrelated system state.

## Definition of Done

- App, real Mistral OCR integration, validation, normalization, sanitization, bilingual UI, themes, presentation mode, exports, cancellation, health, rate limits, concurrency, Docker, Nginx, scripts, and docs are complete.
- `npm install`, formatting, lint, typecheck, unit/API/component tests, Playwright, security check, production build, Docker build, Compose health check, and browser verification have been run or exact blockers documented.
- `SECURITY_REVIEW.md` is written and all high/critical findings are fixed.
- No secrets, fake production OCR paths, permanent upload retention, or unsafe raw OCR HTML rendering remain.
