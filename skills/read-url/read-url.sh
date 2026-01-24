#!/bin/bash
# Read URL as markdown using Jina Reader API

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <url>" >&2
    echo "Example: $0 https://example.com" >&2
    exit 1
fi

URL="$1"

# Build curl headers from environment variables
HEADERS=()

if [ -n "$X_NO_CACHE" ]; then
    HEADERS+=(-H "x-no-cache: true")
fi

if [ -n "$X_TARGET_SELECTOR" ]; then
    HEADERS+=(-H "x-target-selector: $X_TARGET_SELECTOR")
fi

if [ -n "$X_WAIT_FOR_SELECTOR" ]; then
    HEADERS+=(-H "x-wait-for-selector: $X_WAIT_FOR_SELECTOR")
fi

if [ -n "$X_WITH_GENERATED_ALT" ]; then
    HEADERS+=(-H "x-with-generated-alt: true")
fi

curl -sS "${HEADERS[@]}" "https://r.jina.ai/${URL}"
