#!/bin/bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check platform
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Darwin" ] || [ "$ARCH" != "arm64" ]; then
    echo "Error: This skill requires macOS on Apple Silicon (arm64)."
    echo "  Detected: $OS $ARCH"
    exit 1
fi

# Check uv
if ! command -v uv &>/dev/null; then
    echo "Error: uv is required but not found."
    echo "  Install: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

if [ $# -lt 1 ]; then
    echo "Usage: convert.sh <input-file> [options]"
    echo ""
    echo "OCR images and PDFs to Markdown using Qwen3.5 VL via MLX."
    echo ""
    echo "Supported formats: .pdf, .png, .jpg, .jpeg, .tiff, .tif, .webp, .bmp"
    echo ""
    echo "Options:"
    echo "  --think          Enable model reasoning (slower, sometimes better)"
    echo "  --pages 1,3-5    Page range for PDFs (1-indexed, default: all)"
    echo "  --output <path>  Custom output path (default: <input>.md)"
    exit 1
fi

exec uv run \
    --with 'mlx-vlm>=0.3.12' \
    --with pypdfium2 \
    --with pillow \
    --with torch \
    --with torchvision \
    -- python3 "$SKILL_DIR/convert.py" "$@"
