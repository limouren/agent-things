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

echo "Setting up OCR skill..."

# Pre-download models by doing a dry import
echo "Installing Python dependencies..."
uv run --with 'mlx-vlm>=0.3.12' --with pypdfium2 --with pillow --with torch --with torchvision \
    -- python3 -c "print('Dependencies OK')" 2>&1

echo ""
echo "Pre-downloading Qwen3.5-4B-4bit model (~2.5 GB)..."
uv run --with 'mlx-vlm>=0.3.12' --with pypdfium2 --with pillow --with torch --with torchvision \
    -- python3 -c "
from mlx_vlm import load
print('Downloading mlx-community/Qwen3.5-4B-MLX-4bit...')
model, processor = load('mlx-community/Qwen3.5-4B-MLX-4bit')
del model, processor
print('Model cached.')
" 2>&1

echo ""
echo "OCR skill setup complete."
