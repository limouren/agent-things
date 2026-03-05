---
name: pandoc
description: Convert binary documents (docx, pptx, odt, odp, epub, rtf) to Markdown for reading. Use when the user asks to read, analyze, or work with a document in one of these formats.
---

# Pandoc Document Converter

Converts binary document formats to Markdown so you can read and work with their content.

**Supported formats:** `.docx`, `.pptx`, `.odt`, `.odp`, `.epub`, `.rtf`

## Setup

Run once to download and install pandoc:

```bash
bash {baseDir}/setup.sh
```

## Convert a Document

```bash
bash {baseDir}/convert.sh <input-file>
```

This produces:
- `<input-file-without-ext>.md` — the Markdown content, next to the original file
- `<input-file-without-ext>_media/` — extracted images (if the document contains any)

## Workflow

1. Run the convert script on the document
2. Read the resulting `.md` file to understand the content
3. If images were extracted, reference them from the `_media/` directory

## Example

```bash
# Convert a Word document
bash {baseDir}/convert.sh /path/to/report.docx
# Then read the output
# -> /path/to/report.md
# -> /path/to/report_media/ (if images exist)
```
