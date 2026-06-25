# Video Demo

## Recording Sequence

1. Clean Arabic document: show RTL extraction and page structure.
2. Bilingual invoice with a table: show table extraction and export.
3. Multi-column report: show block detection and bounding boxes.
4. Low-quality scanned image: show confidence scores and low-confidence words.

## Talking Points

- The app previews files locally before upload.
- Submitted documents are sent to the Mistral API for processing.
- OCR extraction returns text, markdown, tables, page structure, block types, and confidence scores.
- Bounding boxes show layout understanding and are not fake demo coordinates.
- Confidence is not a guaranteed measure of text accuracy.
- Files are not permanently stored by this application.
- Processing time comes from server-side OCR processing measurement.
- Limits: 10 MB, 15 PDF pages, one file per request, two concurrent OCR jobs by default.
