---
name: read-url
description: Convert any URL to LLM-friendly markdown. Use when you need to read web pages, documentation, or articles as text content.
---

# Read URL

Convert web pages to clean markdown using Jina Reader API.

## Usage

```bash
{baseDir}/read-url.sh <url>
```

## Examples

```bash
# Read documentation
{baseDir}/read-url.sh https://react-svgr.com/docs/next/

# Read GitHub README
{baseDir}/read-url.sh https://github.com/jina-ai/reader

# Read any article
{baseDir}/read-url.sh https://example.com/article
```

## Features

- Handles JavaScript-rendered pages
- Extracts main content (strips navigation, ads)
- Preserves code blocks and formatting
- Supports PDFs
- Free hosted API (rate-limited)

## Options

Pass headers via environment variables:

```bash
# Skip cache
X_NO_CACHE=true {baseDir}/read-url.sh <url>

# Target specific CSS selector
X_TARGET_SELECTOR="#main-content" {baseDir}/read-url.sh <url>

# Wait for element before extracting
X_WAIT_FOR_SELECTOR=".loaded" {baseDir}/read-url.sh <url>
```
