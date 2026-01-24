#!/bin/bash
#
# Sandboxed document-to-markdown conversion
# Usage: run-sandboxed.sh <input_file> [output_dir] [--no-cleanup]
#
# Security:
# - Conversion: sandbox-exec with network denied
# - Cleanup: pi --sandbox with Anthropic API whitelisted
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <input_file> [output_dir] [--no-cleanup]"
    echo ""
    echo "Options:"
    echo "  --no-cleanup    Skip the cleanup step"
    echo ""
    echo "Security:"
    echo "  - Conversion runs with network disabled (sandbox-exec)"
    echo "  - Cleanup runs with pi --sandbox (Anthropic API whitelisted)"
    echo ""
    echo "Examples:"
    echo "  $0 document.pdf"
    echo "  $0 document.pdf ./output"
    echo "  $0 document.pdf ./output --no-cleanup"
    exit 1
}

# Parse arguments
if [[ $# -lt 1 ]]; then
    usage
fi

INPUT_FILE="$1"
OUTPUT_DIR="${2:-.}"
NO_CLEANUP=false

# Check for --no-cleanup flag
for arg in "$@"; do
    if [[ "$arg" == "--no-cleanup" ]]; then
        NO_CLEANUP=true
    fi
done

# Validate input file
if [[ ! -f "$INPUT_FILE" ]]; then
    echo -e "${RED}Error: Input file not found: $INPUT_FILE${NC}"
    exit 1
fi

# Resolve absolute paths
INPUT_FILE="$(cd "$(dirname "$INPUT_FILE")" && pwd)/$(basename "$INPUT_FILE")"
OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"

# Create sandbox profile for conversion (no network)
CONVERT_PROFILE=$(mktemp /tmp/sandbox-convert.XXXXXX.sb)
cat > "$CONVERT_PROFILE" << 'EOF'
(version 1)
(allow default)
(deny network*)
EOF

echo -e "${GREEN}=== Sandboxed Document Conversion ===${NC}"
echo "Input:  $INPUT_FILE"
echo "Output: $OUTPUT_DIR"
echo ""

# Check if file is a spreadsheet (needs weasyprint which requires DYLD_LIBRARY_PATH)
# macOS SIP strips DYLD_* from sandboxed processes, so we skip sandbox for spreadsheets
FILE_EXT="${INPUT_FILE##*.}"
FILE_EXT_LOWER=$(echo "$FILE_EXT" | tr '[:upper:]' '[:lower:]')

if [[ "$FILE_EXT_LOWER" == "xlsx" || "$FILE_EXT_LOWER" == "xls" ]]; then
    # Spreadsheets need weasyprint, which requires DYLD_LIBRARY_PATH for pango/gobject
    # macOS SIP strips DYLD_* from sandboxed processes, so we run without sandbox
    echo -e "${YELLOW}[1/2] Converting spreadsheet (weasyprint requires unsandboxed execution)...${NC}"
    if DYLD_LIBRARY_PATH="/opt/homebrew/lib:${DYLD_LIBRARY_PATH:-}" \
        uv run --project "$SCRIPT_DIR" python "$SCRIPT_DIR/convert.py" \
        "$INPUT_FILE" -o "$OUTPUT_DIR" 2>&1; then
        echo -e "${GREEN}✓ Conversion complete${NC}"
    else
        echo -e "${RED}✗ Conversion failed${NC}"
        rm -f "$CONVERT_PROFILE"
        exit 1
    fi
else
    # Run conversion in sandbox (no network) for PDFs and other formats
    echo -e "${YELLOW}[1/2] Converting document (sandboxed, network disabled)...${NC}"
    if sandbox-exec -f "$CONVERT_PROFILE" \
        uv run --project "$SCRIPT_DIR" python "$SCRIPT_DIR/convert.py" \
        "$INPUT_FILE" -o "$OUTPUT_DIR" 2>&1; then
        echo -e "${GREEN}✓ Conversion complete${NC}"
    else
        echo -e "${RED}✗ Conversion failed${NC}"
        rm -f "$CONVERT_PROFILE"
        exit 1
    fi
fi

rm -f "$CONVERT_PROFILE"

# Find the output markdown file
BASENAME="$(basename "$INPUT_FILE" | sed 's/\.[^.]*$//')"
OUTPUT_MD="$OUTPUT_DIR/$BASENAME.md"

if [[ ! -f "$OUTPUT_MD" ]]; then
    echo -e "${RED}Error: Expected output not found: $OUTPUT_MD${NC}"
    exit 1
fi

# Skip cleanup if requested
if [[ "$NO_CLEANUP" == true ]]; then
    echo ""
    echo -e "${GREEN}Done (cleanup skipped)${NC}"
    echo "Output: $OUTPUT_MD"
    exit 0
fi

# Copy sandbox config to output directory for pi --sandbox
cp "$SCRIPT_DIR/sandbox.json" "$OUTPUT_DIR/.pi/sandbox.json" 2>/dev/null || {
    mkdir -p "$OUTPUT_DIR/.pi"
    cp "$SCRIPT_DIR/sandbox.json" "$OUTPUT_DIR/.pi/sandbox.json"
}

# Run cleanup with pi --sandbox (Anthropic API whitelisted)
echo ""
echo -e "${YELLOW}[2/2] Cleaning up markdown (pi --sandbox, API whitelisted)...${NC}"

CLEANUP_TASK="Clean up the markdown file at $OUTPUT_MD. This is a document converted from PDF. Please:
1. Standardize heading levels (H1 for title, H2 for main sections)
2. Join paragraphs that were broken across pages
3. Fix any malformed tables
4. Remove artifacts (page numbers, headers/footers in wrong places)
5. Fix image paths to be relative
6. Preserve all content, only fix formatting issues"

cd "$OUTPUT_DIR"
if pi --sandbox --print -p "$CLEANUP_TASK" 2>&1; then
    echo -e "${GREEN}✓ Cleanup complete${NC}"
else
    echo -e "${YELLOW}⚠ Cleanup may have issues (check output)${NC}"
fi

# Clean up temp sandbox config
rm -rf "$OUTPUT_DIR/.pi"

echo ""
echo -e "${GREEN}=== Done ===${NC}"
echo "Output: $OUTPUT_MD"
