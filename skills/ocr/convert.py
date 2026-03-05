"""OCR images and PDFs to Markdown using Qwen3.5 VL via MLX."""

import argparse
import sys
import time
from pathlib import Path

from mlx_vlm import load, generate
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config
from PIL import Image

MODEL = "mlx-community/Qwen3.5-4B-MLX-4bit"

PROMPT = "Convert this page to markdown. Do not miss any text and only output the bare markdown!"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".webp", ".bmp"}
PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS


def parse_page_range(spec: str, total_pages: int) -> list[int]:
    """Parse a page range spec like '1,3-5,8' into 0-indexed page numbers."""
    pages = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            start, end = part.split("-", 1)
            start = int(start)
            end = int(end)
            pages.extend(range(start - 1, min(end, total_pages)))
        else:
            p = int(part) - 1
            if 0 <= p < total_pages:
                pages.append(p)
    return sorted(set(pages))


def pdf_to_images(pdf_path: str, page_indices: list[int] | None = None, scale: float = 2.0) -> list[Image.Image]:
    """Render PDF pages to PIL images."""
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(pdf_path)
    total = len(doc)

    if page_indices is None:
        page_indices = list(range(total))

    images = []
    for idx in page_indices:
        if idx < 0 or idx >= total:
            print(f"  Warning: page {idx + 1} out of range (1-{total}), skipping", file=sys.stderr)
            continue
        page = doc[idx]
        bitmap = page.render(scale=scale)
        images.append(bitmap.to_pil())

    doc.close()
    return images


def load_image(path: str) -> Image.Image:
    """Load an image file."""
    img = Image.open(path)
    img.load()
    # Convert to RGB if needed (e.g., RGBA, palette)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def ocr_image(model, processor, config, image: Image.Image, think: bool) -> str:
    """Run OCR on a single image, return markdown text."""
    prompt = apply_chat_template(processor, config, PROMPT, num_images=1)

    if not think:
        prompt = prompt.replace("<think>\n", "<think>\n\n</think>\n\n")

    result = generate(model, processor, prompt, image=[image], max_tokens=8192, verbose=False)
    text = result.text if hasattr(result, "text") else str(result)

    # Strip markdown fences if the model wraps output in ```markdown ... ```
    text = text.strip()
    if text.startswith("```markdown"):
        text = text[len("```markdown") :].strip()
    if text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[: -3].strip()

    return text


def main():
    parser = argparse.ArgumentParser(description="OCR images and PDFs to Markdown")
    parser.add_argument("input", help="Input file (image or PDF)")
    parser.add_argument("--output", "-o", help="Output markdown file (default: <input>.md)")
    parser.add_argument("--think", action="store_true", help="Enable model reasoning")
    parser.add_argument("--pages", help="Page range for PDFs, e.g. '1,3-5' (1-indexed)")
    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    if not input_path.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    ext = input_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        print(f"Error: Unsupported format: {ext}", file=sys.stderr)
        print(f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}", file=sys.stderr)
        sys.exit(1)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = input_path.with_suffix(".md")

    # Load images
    if ext in PDF_EXTENSIONS:
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(str(input_path))
        total_pages = len(doc)
        doc.close()

        page_indices = None
        if args.pages:
            page_indices = parse_page_range(args.pages, total_pages)
            print(f"PDF: {total_pages} pages, converting pages: {[p + 1 for p in page_indices]}")
        else:
            print(f"PDF: {total_pages} pages, converting all")

        images = pdf_to_images(str(input_path), page_indices)
    else:
        print(f"Image: {input_path.name}")
        images = [load_image(str(input_path))]

    if not images:
        print("Error: No images to process", file=sys.stderr)
        sys.exit(1)

    # Load model
    model_repo = MODEL
    print(f"Model: {model_repo} (thinking={'ON' if args.think else 'OFF'})")
    model, processor = load(model_repo)
    config = load_config(model_repo)

    # Process each image
    results = []
    total_start = time.time()

    for i, image in enumerate(images):
        label = f"Page {i + 1}/{len(images)}" if len(images) > 1 else "Processing"
        print(f"  {label}...", end=" ", flush=True)

        start = time.time()
        text = ocr_image(model, processor, config, image, args.think)
        elapsed = time.time() - start

        print(f"done ({elapsed:.1f}s, {len(text)} chars)")
        results.append(text)

    total_elapsed = time.time() - total_start

    # Write output
    separator = "\n\n---\n\n"
    output = separator.join(results)
    output_path.write_text(output)

    print(f"\nOutput: {output_path} ({len(output)} bytes)")
    print(f"Total:  {total_elapsed:.1f}s")


if __name__ == "__main__":
    main()
