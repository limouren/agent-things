---
name: doc-to-markdown
description: Convert documents (PDF, DOCX, PPTX, XLSX, images) to clean markdown using marker. Use when user wants to extract text from documents, convert PDFs to markdown, or process document files.
---

# Document to Markdown

Convert documents to clean, well-formatted markdown using [marker](https://github.com/datalab-to/marker).

## Supported Formats

- PDF (including scanned)
- DOCX, PPTX, XLSX
- HTML, EPUB
- Images (PNG, JPG, etc.)

## Setup

Run once to sync dependencies:

```bash
cd {baseDir} && uv sync
```

**Note:** For XLSX support, you also need system libraries (macOS):
```bash
brew install pango
```

## Usage

```bash
{baseDir}/run.sh <input_file> [output_dir]
```

### Options

```bash
# Convert with cleanup (default)
{baseDir}/run.sh document.pdf ./output

# Convert only, skip cleanup
{baseDir}/run.sh document.pdf ./output --no-cleanup
```

### Output

Creates:
- `<output_dir>/<filename>.md` - Markdown file
- `<output_dir>/<filename>_images/` - Extracted images

## Examples

### Convert a PDF

```bash
{baseDir}/run.sh ~/Documents/contract.pdf ~/Documents/
```

### Convert without cleanup

```bash
{baseDir}/run.sh document.pdf ./output --no-cleanup
```

### Batch convert

```bash
for f in *.pdf; do
  {baseDir}/run.sh "$f" ./converted/
done
```

## Output

The converter outputs standard markdown with:
- Headings extracted from document structure
- Tables preserved in markdown format
- Images saved separately and referenced
- Code blocks for detected code
- Lists and formatting preserved

## Troubleshooting

### "marker-pdf not installed"

Run the setup command:
```bash
cd {baseDir} && uv venv && uv pip install marker-pdf
```

### Slow first run

First run downloads ML models (~2GB). Subsequent runs are faster.

### Poor OCR quality

Use `--force-ocr` for scanned documents. For best results on scanned Chinese documents, the text should be clear and high-resolution.
