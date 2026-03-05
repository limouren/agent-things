#!/bin/bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
PANDOC="$SKILL_DIR/bin/pandoc"

if [ ! -x "$PANDOC" ]; then
    echo "Error: pandoc not found. Run setup first:"
    echo "  bash $SKILL_DIR/setup.sh"
    exit 1
fi

if [ $# -lt 1 ]; then
    echo "Usage: convert.sh <input-file>"
    echo ""
    echo "Converts a document to Markdown."
    echo "Supported formats: .docx, .pptx, .odt, .odp, .epub, .rtf"
    echo ""
    echo "Output: <input-file>.md (next to the original)"
    echo "Media:  <input-file>_media/ (if the document contains images)"
    exit 1
fi

INPUT="$1"

if [ ! -f "$INPUT" ]; then
    echo "Error: File not found: $INPUT"
    exit 1
fi

# Get file extension and base name
FILENAME=$(basename "$INPUT")
EXTENSION="${FILENAME##*.}"
EXTENSION_LOWER=$(echo "$EXTENSION" | tr '[:upper:]' '[:lower:]')

# Resolve to absolute path
INPUT=$(cd "$(dirname "$INPUT")" && echo "$(pwd)/$(basename "$INPUT")")
BASENAME="${INPUT%.*}"

OUTPUT="${BASENAME}.md"
MEDIA_DIR="${BASENAME}_media"

# Map extensions to pandoc input formats
case "$EXTENSION_LOWER" in
    docx) FORMAT="docx" ;;
    pptx) FORMAT="pptx" ;;
    odt)  FORMAT="odt" ;;
    odp)  FORMAT="odt" ;;  # Try odt reader for odp
    epub) FORMAT="epub" ;;
    rtf)  FORMAT="rtf" ;;
    *)
        echo "Error: Unsupported format: .$EXTENSION"
        echo "Supported formats: .docx, .pptx, .odt, .odp, .epub, .rtf"
        exit 1
        ;;
esac

echo "Converting: $INPUT"
echo "    Format: $FORMAT -> markdown"

"$PANDOC" \
    --from="$FORMAT" \
    --to=markdown \
    --extract-media="$MEDIA_DIR" \
    --wrap=none \
    --standalone \
    "$INPUT" \
    -o "$OUTPUT"

echo "    Output: $OUTPUT"
if [ -d "$MEDIA_DIR" ]; then
    MEDIA_COUNT=$(find "$MEDIA_DIR" -type f | wc -l | tr -d ' ')
    echo "     Media: $MEDIA_DIR/ ($MEDIA_COUNT files)"
fi
