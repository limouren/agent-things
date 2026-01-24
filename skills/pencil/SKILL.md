---
name: pencil
description: Design and edit UI layouts in Pencil.app .pen files. Use when working with .pen design files, creating UI mockups, generating code from designs, or when user mentions Pencil app. Supports reading designs, creating/editing layouts, taking screenshots for validation, and extracting design tokens.
---

# Pencil Design Tool Integration

Interface with Pencil.app to read, create, and modify `.pen` design files. Pencil is a design tool for web and mobile UI.

**IMPORTANT:** The contents of `.pen` files are encrypted - you MUST use these tools to read/write them. Do NOT use `Read` or `cat` on `.pen` files directly.

## Setup

```bash
cd {baseDir} && npm install
```

**Prerequisites:** Pencil.app must be running before using these tools.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `state` | Get current editor state, selection, active file |
| `open` | Open/create .pen files |
| `get` | Read/search nodes in design files |
| `design` | Insert/update/delete design elements |
| `screenshot` | Visual validation of designs |
| `layout` | Check layout structure |
| `guidelines` | Get design best practices |
| `style-guide` | Get design inspiration |
| `variables` | Read design tokens/themes |

## Core Workflow

### 1. Start by Getting Editor State

Always begin by understanding what's currently open:

```bash
{baseDir}/pencil.ts state
```

This returns:
- Currently active `.pen` file path
- User's current selection
- Available design context

### 2. Read Design Structure

Search for components or read specific nodes:

```bash
# List all reusable components (design system)
{baseDir}/pencil.ts get --file ./design.pen --patterns '[{"reusable": true}]' --read-depth 2

# Read specific nodes by ID
{baseDir}/pencil.ts get --file ./design.pen --node-ids '["nodeId1", "nodeId2"]'

# Search for frames
{baseDir}/pencil.ts get --file ./design.pen --patterns '[{"type": "frame"}]'

# Get top-level document structure
{baseDir}/pencil.ts get --file ./design.pen
```

### 3. Make Design Changes

Use `batch_design` to execute operations. Operations use a script syntax:

```bash
{baseDir}/pencil.ts design --file ./design.pen --operations '
sidebar=I("parentId", {type: "ref", ref: "SidebarComp", width: 240})
content=I("parentId", {type: "frame", layout: "vertical", gap: 16})
header=I(content, {type: "text", content: "Dashboard", fontSize: 24})
'
```

#### Operation Types

- **Insert (I):** `binding=I(parent, {nodeData})`
- **Copy (C):** `binding=C(sourceId, parent, {overrides})`
- **Update (U):** `U(nodeId, {properties})`
- **Replace (R):** `binding=R(path, {newNodeData})`
- **Delete (D):** `D(nodeId)`
- **Move (M):** `M(nodeId, newParent, index)`
- **Generate Image (G):** `G(nodeId, "ai"|"stock", "prompt")`

#### Key Rules

1. Every I/C/R operation MUST have a binding name
2. Use `"document"` to reference the root
3. Max 25 operations per call
4. Use bindings with `+` for paths: `U(card+"/label", {content: "New"})`

### 4. Validate Visually

Always check your work with screenshots:

```bash
{baseDir}/pencil.ts screenshot --file ./design.pen --node-id "frameId"
```

Screenshots are saved to `/tmp/pencil-screenshot-*.png`.

## Detailed Tool Reference

### state (get_editor_state)

Get current editor context. Start here for any design task.

```bash
{baseDir}/pencil.ts state
{baseDir}/pencil.ts state --include-schema true  # Include .pen schema
```

### open (open_document)

Open an existing file or create new:

```bash
{baseDir}/pencil.ts open --file ./path/to/design.pen
{baseDir}/pencil.ts open --file new  # Create blank document
```

### get (batch_get)

Read and search nodes. Combine multiple searches in one call for efficiency.

```bash
# Search patterns
{baseDir}/pencil.ts get --file ./design.pen \
  --patterns '[{"reusable": true}, {"type": "text"}]'

# Read by IDs
{baseDir}/pencil.ts get --file ./design.pen \
  --node-ids '["id1", "id2", "id3"]'

# Control depth
{baseDir}/pencil.ts get --file ./design.pen \
  --patterns '[{"type": "frame"}]' \
  --read-depth 3 \
  --search-depth 5

# Resolve component instances to see full structure
{baseDir}/pencil.ts get --file ./design.pen \
  --node-ids '["instanceId"]' \
  --resolve-instances true
```

### design (batch_design)

Execute design operations. This is the main tool for making changes.

```bash
{baseDir}/pencil.ts design --file ./design.pen --operations '
# Create a card component instance
card=I("container", {type: "ref", ref: "CardComp", width: "fill_container"})

# Update text inside the card
U(card+"/title", {content: "Welcome"})
U(card+"/subtitle", {content: "Getting started guide"})

# Add an image
heroImg=I(card+"/imageSlot", {type: "frame", width: "fill_container", height: 200})
G(heroImg, "stock", "modern workspace desk setup")
'
```

#### Working with Components

```javascript
// Insert component instance
card=I("parent", {type: "ref", ref: "CardComponent"})

// Update descendant properties
U(card+"/titleText", {content: "New Title"})

// Replace a slot entirely
newContent=R(card+"/contentSlot", {type: "text", content: "Custom content"})

// Override children on insert
card=I("parent", {type: "ref", ref: "CardComp", children: [{type: "text", content: "Override"}]})
```

### screenshot (get_screenshot)

Capture visual state for validation. **Always use this to verify your changes look correct.**

```bash
{baseDir}/pencil.ts screenshot --file ./design.pen --node-id "frameId"
# Output: [Screenshot saved to: /tmp/pencil-screenshot-1234567890.png]
```

### layout (snapshot_layout)

Check computed layout rectangles. Useful for positioning and debugging.

```bash
{baseDir}/pencil.ts layout --file ./design.pen --max-depth 2
{baseDir}/pencil.ts layout --file ./design.pen --problems-only true
```

### guidelines (get_guidelines)

Get design rules for specific contexts:

```bash
{baseDir}/pencil.ts guidelines --topic code          # Code generation
{baseDir}/pencil.ts guidelines --topic table         # Tables/dashboards
{baseDir}/pencil.ts guidelines --topic tailwind      # Tailwind CSS
{baseDir}/pencil.ts guidelines --topic landing-page  # Marketing pages
{baseDir}/pencil.ts guidelines --topic design-system # Component usage
```

### style-tags & style-guide

Get design inspiration:

```bash
# First, get available tags
{baseDir}/pencil.ts style-tags

# Then get a style guide with relevant tags
{baseDir}/pencil.ts style-guide --tags '["modern", "minimal", "webapp", "dashboard"]'

# Or by specific ID
{baseDir}/pencil.ts style-guide --id "style-guide-id"
```

### variables (get_variables / set_variables)

Work with design tokens and themes:

```bash
# Read current variables
{baseDir}/pencil.ts variables --file ./design.pen

# Update variables
{baseDir}/pencil.ts set_variables --file ./design.pen \
  --variables '{"primary": "#3B82F6", "spacing-md": 16}'
```

### find-space (find_empty_space_on_canvas)

Find empty area for new content:

```bash
{baseDir}/pencil.ts find-space --file ./design.pen \
  --width 400 --height 600 --padding 50 --direction right
```

### search-props / replace-props

Bulk property operations:

```bash
# Find all unique colors used
{baseDir}/pencil.ts search-props --file ./design.pen \
  --parents '["frameId"]' \
  --properties '["fillColor", "textColor"]'

# Replace colors across design
{baseDir}/pencil.ts replace-props --file ./design.pen \
  --parents '["frameId"]' \
  --properties '{"fillColor": [{"from": "#old", "to": "#new"}]}'
```

## Common Patterns

### Create a New Screen

```bash
# 1. Get state and available components
{baseDir}/pencil.ts state
{baseDir}/pencil.ts get --file ./app.pen --patterns '[{"reusable": true}]'

# 2. Get style guide for inspiration
{baseDir}/pencil.ts style-tags
{baseDir}/pencil.ts style-guide --tags '["webapp", "dashboard", "modern"]'

# 3. Create the screen
{baseDir}/pencil.ts design --file ./app.pen --operations '
screen=I(document, {type: "frame", name: "Dashboard", width: 1440, height: 900, layout: "horizontal"})
sidebar=I(screen, {type: "ref", ref: "SidebarComp", width: 240, height: "fill_container"})
main=I(screen, {type: "frame", layout: "vertical", gap: 24, padding: 32, width: "fill_container"})
'

# 4. Validate visually
{baseDir}/pencil.ts screenshot --file ./app.pen --node-id "screen-id"
```

### Generate Code from Design

```bash
# 1. Get code generation guidelines
{baseDir}/pencil.ts guidelines --topic code
{baseDir}/pencil.ts guidelines --topic tailwind

# 2. Read the design structure
{baseDir}/pencil.ts get --file ./design.pen \
  --node-ids '["targetFrameId"]' \
  --read-depth 10 \
  --resolve-instances true

# 3. Get design tokens
{baseDir}/pencil.ts variables --file ./design.pen

# 4. Generate code based on the structure and tokens
```

### Duplicate and Modify

```bash
{baseDir}/pencil.ts design --file ./design.pen --operations '
# Copy a screen
newScreen=C("originalScreenId", document, {name: "Screen V2", positionDirection: "right", positionPadding: 100})

# Modify the copy
U(newScreen+"/header/title", {content: "Updated Title"})
D(newScreen+"/sidebar")
'
```

## Tips

1. **Always start with `state`** to understand current context
2. **Use `get` to explore** before making changes
3. **Keep operations batches small** (max 25 ops)
4. **Validate with `screenshot`** after making changes
5. **Use bindings** to chain operations on newly created nodes
6. **Get guidelines** when working on specific tasks (code, tables, etc.)
