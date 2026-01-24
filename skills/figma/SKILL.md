---
name: figma
description: Fetch Figma design data and download images. Use when implementing UI from Figma designs or when user provides a Figma URL.
---

# Figma Design Integration

Fetch layout, styles, and component data from Figma files. Download images (PNG/SVG) from Figma nodes.

## Setup

```bash
cd ~/.pi/agent/skills/figma && npm install
```

Then configure your Figma API key in `~/.pi/agent/skills/figma/config.json`:

```json
{
  "apiKey": "figd_YOUR_API_KEY_HERE"
}
```

To get an API key, visit: https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens

## Tools

### Get Figma Data

Fetch design data (layout, styles, components) from a Figma file or specific node.

```bash
# Get entire file
~/.pi/agent/skills/figma/get-data.ts <fileKey>

# Get specific node (from URL's node-id parameter)
~/.pi/agent/skills/figma/get-data.ts <fileKey> --node-id <nodeId>

# Limit depth of traversal
~/.pi/agent/skills/figma/get-data.ts <fileKey> --node-id <nodeId> --depth 3
```

**Parameters:**
- `fileKey`: The file key from Figma URL (e.g., `figma.com/design/ABC123/...` → `ABC123`)
- `--node-id`: Optional. Node ID from URL's `node-id=` parameter (format: `1234:5678` or `1234-5678`)
- `--depth`: Optional. Limit how deep to traverse the node tree

**Output:** YAML with simplified design data including:
- Node hierarchy with layout properties (position, size, constraints, auto-layout)
- Text content and styles
- Visual properties (fills, strokes, effects)
- Component information
- Global styles

### Download Figma Images

Download images (PNG/SVG) from Figma nodes to a local directory.

```bash
~/.pi/agent/skills/figma/download-images.ts <fileKey> <outputDir> '<nodesJson>'
```

**Parameters:**
- `fileKey`: The Figma file key
- `outputDir`: Local directory to save images (will be created if doesn't exist)
- `nodesJson`: JSON array of nodes to download

**Node JSON format:**
```json
[
  {
    "nodeId": "1234:5678",
    "fileName": "icon.svg"
  },
  {
    "nodeId": "1234:5679",
    "fileName": "hero-image.png",
    "imageRef": "abc123..."
  }
]
```

**Node properties:**
- `nodeId`: Required. The node ID to export
- `fileName`: Required. Output filename (must end in `.png` or `.svg`)
- `imageRef`: Optional. For image fills, include the imageRef from the design data
- `pngScale`: Optional. Scale for PNG exports (default: 2)

## Workflow

1. User provides a Figma URL like `https://www.figma.com/design/ABC123/MyDesign?node-id=1-234`
2. Extract `fileKey` (ABC123) and `nodeId` (1-234) from the URL
3. Run `get-data.ts` to fetch the design structure
4. Analyze the YAML output for layout, components, and image nodes
5. Use `download-images.ts` to fetch any required images
6. Implement the design in code using the extracted data

## Example

```bash
# Fetch a specific frame from a Figma file
~/.pi/agent/skills/figma/get-data.ts ABC123def --node-id 1-234

# Download images referenced in the design
~/.pi/agent/skills/figma/download-images.ts ABC123def ./assets '[{"nodeId":"5:67","fileName":"logo.svg"},{"nodeId":"5:68","fileName":"bg.png"}]'
```
