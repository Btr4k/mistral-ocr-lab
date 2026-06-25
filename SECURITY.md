# Security

## Threat Model

Primary risks are malicious file uploads, malformed PDFs/images, OCR output XSS, API-key leakage, cost exhaustion, and accidental retention of sensitive documents.

## File Upload Risks

The server checks file presence, size, extension, MIME type, and magic signatures. Unsupported formats including SVG, DOCX, PPTX, ZIP, executables, empty files, and unknown binaries are rejected.

## Malformed PDF Risks

PDFs are parsed only for page count with `pdf-lib`. Encrypted, corrupted, and over-limit PDFs return safe errors. Uploaded PDFs are not written to public paths.

## XSS Risk From OCR Output

Markdown is rendered without unsafe raw HTML. Table HTML is sanitized with a narrow allowlist before `dangerouslySetInnerHTML` is used.

## API-Key Protection

`MISTRAL_API_KEY` is read only in server modules. It is ignored by Git, not copied into Docker layers, not exposed by health checks, and never returned to clients.

## Abuse And Cost Exhaustion

The app rate-limits requests, rejects excess concurrency, uses Nginx request limits, and applies OCR timeouts.

## Data Retention

Files are handled in memory where practical. No database, public storage, or OCR response cache is used.

## Logging Policy

Logs include request ID, event, route, safe code/status, duration, file type/size, page count, and upstream status category. Logs must not include filenames, document text, tables, Base64, cookies, authorization headers, or API keys.

## Nginx Protections

Nginx limits upload size, applies endpoint-specific rate limits, proxies only to loopback, and adds security headers without wildcard CSP relaxation.

## Remaining Risks

Single-instance in-memory rate limiting is not distributed. Upstream OCR handling is governed by Mistral's service. No authentication exists in v1.

## Production Hardening

Add distributed rate limiting if multiple instances are deployed, consider authentication for private demos, monitor costs, and configure alerting for repeated 4xx/5xx spikes.

## Incident Response Basics

Rotate the Mistral API key, disable the Nginx site if abuse is ongoing, preserve safe logs, inspect deployment diffs, and redeploy from a known-good image.
