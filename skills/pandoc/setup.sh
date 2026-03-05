#!/bin/bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$SKILL_DIR/bin"
PANDOC="$BIN_DIR/pandoc"

# Check if already installed
if [ -x "$PANDOC" ]; then
    echo "pandoc already installed: $("$PANDOC" --version | head -1)"
    exit 0
fi

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin) OS_LABEL="macOS" ;;
    Linux)  OS_LABEL="linux" ;;
    *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64)        ARCH_LABEL="x86_64"; ARCH_LABEL_LINUX="amd64" ;;
    arm64|aarch64) ARCH_LABEL="arm64";  ARCH_LABEL_LINUX="arm64" ;;
    *)             echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Get latest release info
echo "Fetching latest pandoc release info..."
RELEASE_JSON=$(curl -sL https://api.github.com/repos/jgm/pandoc/releases/latest)
VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*: "\(.*\)".*/\1/')

if [ -z "$VERSION" ]; then
    echo "Error: Could not determine latest pandoc version"
    exit 1
fi

# Construct asset name
if [ "$OS_LABEL" = "macOS" ]; then
    ASSET_NAME="pandoc-${VERSION}-${ARCH_LABEL}-macOS.zip"
elif [ "$OS_LABEL" = "linux" ]; then
    ASSET_NAME="pandoc-${VERSION}-linux-${ARCH_LABEL_LINUX}.tar.gz"
fi

# Find download URL
DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url.*${ASSET_NAME}" | head -1 | sed 's/.*"\(https:\/\/[^"]*\)".*/\1/')

if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: Could not find download URL for $ASSET_NAME"
    echo "Available assets:"
    echo "$RELEASE_JSON" | grep "browser_download_url" | sed 's/.*"\(https:\/\/[^"]*\)".*/  \1/'
    exit 1
fi

echo "Downloading pandoc $VERSION for $OS_LABEL $ARCH..."
mkdir -p "$BIN_DIR"
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

curl -sL "$DOWNLOAD_URL" -o "$TMPDIR/$ASSET_NAME"

# Extract pandoc binary
if [ "$OS_LABEL" = "macOS" ]; then
    unzip -q "$TMPDIR/$ASSET_NAME" -d "$TMPDIR"
else
    tar xzf "$TMPDIR/$ASSET_NAME" -C "$TMPDIR"
fi

# Find the pandoc binary in extracted files
PANDOC_BIN=$(find "$TMPDIR" -name "pandoc" -type f | head -1)

if [ -z "$PANDOC_BIN" ]; then
    echo "Error: Could not find pandoc binary in extracted archive"
    exit 1
fi

cp "$PANDOC_BIN" "$BIN_DIR/pandoc"
chmod +x "$BIN_DIR/pandoc"

echo "pandoc installed: $("$PANDOC" --version | head -1)"
