#!/usr/bin/env python3
"""
Convert documents to markdown using marker.

Supports: PDF, DOCX, PPTX, XLSX, HTML, EPUB, images
"""

import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Convert documents to markdown using marker"
    )
    parser.add_argument("input", type=Path, help="Input file path")
    parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=None,
        help="Output directory (default: same as input file)"
    )
    parser.add_argument(
        "--force-ocr",
        action="store_true",
        help="Force OCR on all pages (for scanned documents)"
    )
    parser.add_argument(
        "--no-images",
        action="store_true",
        help="Don't extract images"
    )
    parser.add_argument(
        "--pages",
        type=str,
        default=None,
        help="Page range to process (e.g., '0,5-10,20')"
    )

    args = parser.parse_args()

    # Validate input
    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    # Set output directory
    output_dir = args.output_dir or args.input.parent
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Import marker (lazy import to speed up --help)
    try:
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.output import text_from_rendered
        from marker.config.parser import ConfigParser
    except ImportError:
        print("Error: marker-pdf not installed. Run:", file=sys.stderr)
        print(f"  cd {Path(__file__).parent} && uv sync", file=sys.stderr)
        sys.exit(1)

    # Build config
    config = {
        "output_format": "markdown",
        "paginate_output": False,
    }
    
    if args.force_ocr:
        config["force_ocr"] = True
    
    if args.no_images:
        config["disable_image_extraction"] = True
    
    if args.pages:
        config["page_range"] = args.pages

    # Convert
    print(f"Converting: {args.input}")
    
    config_parser = ConfigParser(config)
    converter = PdfConverter(
        config=config_parser.generate_config_dict(),
        artifact_dict=create_model_dict(),
        processor_list=config_parser.get_processors(),
        renderer=config_parser.get_renderer(),
    )
    
    rendered = converter(str(args.input.resolve()))
    text, metadata, images = text_from_rendered(rendered)

    # Write markdown
    output_stem = args.input.stem
    output_md = output_dir / f"{output_stem}.md"
    output_md.write_text(text, encoding="utf-8")
    print(f"Markdown: {output_md}")

    # Write images
    if images and not args.no_images:
        images_dir = output_dir / f"{output_stem}_images"
        images_dir.mkdir(exist_ok=True)
        
        for img_name, img_obj in images.items():
            img_path = images_dir / img_name
            # img_obj is a PIL Image, save it directly
            img_obj.save(str(img_path))
        
        print(f"Images: {images_dir}/ ({len(images)} files)")

    print("Done!")
    return str(output_md)


if __name__ == "__main__":
    main()
