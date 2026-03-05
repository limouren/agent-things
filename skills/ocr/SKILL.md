---
name: ocr
description: OCR images and PDFs to Markdown using Qwen3.5 VL via MLX on Apple Silicon. Use when the user needs to extract text from images, scanned PDFs, photos of documents, or any visual content with text. Supports PNG, JPG, TIFF, WebP, BMP, and PDF files.
compatibility: macOS Apple Silicon only (requires MLX)
---

# OCR — Visual Document to Markdown

Converts images and PDFs to Markdown using Qwen3.5 Vision-Language models running locally on Apple Silicon via MLX.

Best for: scanned documents, photos, complex layouts, CJK content, credit card bills, invoices, receipts — anything where traditional PDF text extraction fails.

## Setup

Run once to install dependencies and pre-download the model (~2.5 GB):

```bash
bash {baseDir}/setup.sh
```

## Convert a File

```bash
bash {baseDir}/convert.sh <input-file>
```

Supported formats: `.pdf`, `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif`, `.webp`, `.bmp`

Output: `<input-file-without-ext>.md` next to the original file.

## Options

```bash
bash {baseDir}/convert.sh <input-file> [options]

Options:
  --think          Enable model reasoning (slower, sometimes better for complex layouts)
  --pages 1,3-5    Page range for PDFs (1-indexed, default: all pages)
  --output <path>  Custom output path (default: <input>.md)
```

## Examples

```bash
# OCR a scanned PDF
bash {baseDir}/convert.sh /path/to/scan.pdf

# OCR a photo of a receipt
bash {baseDir}/convert.sh /path/to/receipt.jpg

# OCR specific pages of a PDF
bash {baseDir}/convert.sh /path/to/document.pdf --pages 1,3-5
```

## Workflow

1. Run the convert script on the image or PDF
2. Read the resulting `.md` file to understand the content
3. For multi-page PDFs, pages are separated by `---` in the output
