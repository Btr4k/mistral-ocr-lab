# AGENTS.md

## Project Purpose

`Mistral OCR 4 Live Lab` is an A8D.AI technical demonstration for securely uploading one supported document, processing it with Mistral OCR 4, and inspecting extracted text, structure, tables, bounding boxes, confidence scores, and normalized JSON.

## Architecture

- Next.js App Router with strict TypeScript.
- Server-only OCR integration in `src/lib/mistral`.
- Server validation and security helpers in `src/lib/validation` and `src/lib/security`.
- Application-owned OCR contracts in `src/types`.
- Client UI is componentized under `src/components` and hooks under `src/hooks`.
- No database, authentication, public file storage, custom Next server, or serverless-only design in v1.

## Commands

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run format`
- `npm run format:check`
- `npm run test`
- `npm run test:watch`
- `npm run test:e2e`
- `npm run test:ocr:smoke -- path/to/file.pdf`
- `npm run security:check`

## Directory Structure

- `src/app`: App Router pages, layout, styles, and API routes.
- `src/components`: UI, layout, upload, document preview, and result components.
- `src/config`: environment and limit parsing.
- `src/hooks`: focused client state hooks.
- `src/lib`: Mistral integration, validation, security, logging, i18n, and exports.
- `src/types`: stable application API and OCR types.
- `test`: tests and non-sensitive fixtures.
- `deployment`: Docker/Nginx/deployment support files.

## Coding Conventions

- Use TypeScript strict mode and application-owned types for UI contracts.
- Prefer small focused modules over broad abstractions.
- Keep server-only modules free from React imports.
- Keep client components free from server secrets and server-only environment variables.
- Do not label confidence as accuracy.
- Unknown future OCR block types must not crash the app; normalize them to `unknown` while preserving the safe original type.

## Security Constraints

- Never expose `MISTRAL_API_KEY` to client code.
- Never create or use `NEXT_PUBLIC_MISTRAL_API_KEY`.
- Never log uploaded file contents, Base64 data, markdown, table contents, OCR raw payloads, authorization headers, cookies, or API keys.
- Do not write uploaded documents to public directories.
- Do not permanently retain uploaded documents.
- Set `Cache-Control: no-store` on OCR and health API responses.
- Sanitize OCR table HTML with a narrow allowlist before rendering.
- Render markdown without unsafe raw HTML.
- Enforce server-side file validation: size, extension, MIME, file signature, and PDF page count.
- Reject SVG, DOCX, PPTX, ZIP, executables, empty files, corrupted files, encrypted PDFs, and unknown binaries.

## Testing Requirements

- Automated tests must mock Mistral and never call the real API.
- Unit tests must cover validation, signatures, PDF limits, filenames, bounding boxes, confidence summaries, normalization, sanitization, rate limiting, concurrency, and raw-response scrubbing.
- API tests must cover malformed uploads, file validation errors, config errors, mocked OCR success, upstream errors, headers, and rate/concurrency behavior.
- Playwright must mock `/api/health` and `/api/ocr`.
- Manual smoke testing requires an explicit file path and `MISTRAL_API_KEY`; it must not print extracted content.

## Deployment Target

- Production URL: `https://ocr.a8d.ai`.
- VPS public IP: `<YOUR_SERVER_IP>`.
- Production directory: `/opt/mistral-ocr-lab`.
- Docker host binding must remain `127.0.0.1:3010:3000`.
- Public access must go through Nginx only.

## Files That Contain Secrets

- `.env`
- `.env.local`
- `.env.production`
- Any operator-created environment override files.
- These must remain ignored by Git and must not be copied into Docker image layers.

## Required OCR Integration Discipline

- Inspect current installed Mistral SDK types before changing OCR integration.
- Use official SDK only when its current TypeScript types expose all required OCR 4 options.
- If the SDK lacks required current OCR features, use a narrow typed REST adapter isolated in `src/lib/mistral/ocr-client.ts` and document why.
- Preserve official OCR option names exactly as required by the selected adapter.

## Definition of Done

- App builds and all required tests/checks pass, or exact system blockers are documented.
- Real Mistral OCR integration exists without production mocks.
- API key remains server-only.
- Upload validation, page limits, rate limits, concurrency limits, normalization, sanitization, exports, RTL/LTR, themes, presentation mode, cancellation, health, Docker, Nginx, docs, and security review are complete.
- No high or critical security findings remain in `SECURITY_REVIEW.md`.
