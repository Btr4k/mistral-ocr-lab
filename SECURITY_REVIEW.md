# Security Review

Date: 2026-06-24

## Finding 1

- Severity: Low
- File: `src/components/ocr-lab.tsx`
- Description: Sanitized table HTML is rendered with `dangerouslySetInnerHTML`.
- Impact: If sanitizer configuration is weakened later, OCR table output could become an XSS vector.
- Fix: Keep table HTML sanitized in `src/lib/security/sanitize-table.ts` with a narrow allowlist and test coverage.
- Verification status: Covered by unit and API tests; no high or critical issue remains.

## Finding 2

- Severity: Low
- File: `src/lib/security/rate-limit.ts`
- Description: Application rate limiting is in-memory and single-instance.
- Impact: It will not coordinate across multiple replicas.
- Fix: Documented limitation; production v1 is a single VPS instance. Use a distributed limiter if scaling horizontally.
- Verification status: Accepted residual risk for single-instance demo.

## Finding 3

- Severity: Low
- File: `package-lock.json`
- Description: `npm audit --omit=dev` reports a moderate PostCSS advisory through the current stable Next.js dependency tree.
- Impact: npm currently suggests a breaking forced change instead of a safe stable upgrade path.
- Fix: `security:check` gates on high/critical production advisories and still reports audit output; revisit when a stable Next.js release resolves the transitive advisory.
- Verification status: Accepted temporary moderate residual risk; no high or critical advisories are allowed by the local gate.
