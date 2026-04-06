---
name: google-sheets
description: "Google Sheets: Read, write, and manage spreadsheets via the gws CLI. Use when reading cell ranges, appending rows, creating spreadsheets, or performing batch updates."
---

# Google Sheets

Read and write spreadsheets using the `gws` CLI.

## Setup

Run once before first use:

```bash
# Install gws (macOS Apple Silicon)
curl -fsSL https://github.com/googleworkspace/cli/releases/latest/download/gws-darwin-arm64.tar.gz | tar xz
sudo mv gws /usr/local/bin/

# Authenticate (opens browser)
gws auth setup        # first time: creates GCP project, enables APIs, logs in
gws auth login -s sheets   # subsequent logins (select only Sheets scopes)
```

If `gws auth setup` fails (requires `gcloud`), follow the manual OAuth setup:
1. Create a Desktop OAuth client at https://console.cloud.google.com/apis/credentials
2. Download JSON to `~/.config/gws/client_secret.json`
3. Add yourself as a test user in the OAuth consent screen
4. Run `gws auth login`

## Helper Commands

### +read — Read values from a spreadsheet

```bash
gws sheets +read --spreadsheet <ID> --range <RANGE>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--spreadsheet` | ✓ | — | Spreadsheet ID |
| `--range` | ✓ | — | Range in A1 notation (e.g. "Sheet1!A1:D10") |

```bash
gws sheets +read --spreadsheet SPREADSHEET_ID --range "Sheet1!A1:D10"
gws sheets +read --spreadsheet SPREADSHEET_ID --range Sheet1
```

Read-only.

### +append — Append rows to a spreadsheet

```bash
gws sheets +append --spreadsheet <ID>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--spreadsheet` | ✓ | — | Spreadsheet ID |
| `--values` | — | — | Comma-separated values for a single row |
| `--json-values` | — | — | JSON array of rows, e.g. '[["a","b"],["c","d"]]' |
| `--range` | — | A1 | Target range to select a sheet tab (e.g. "Sheet2!A1") |

```bash
gws sheets +append --spreadsheet ID --values 'Alice,100,true'
gws sheets +append --spreadsheet ID --json-values '[["a","b"],["c","d"]]'
gws sheets +append --spreadsheet ID --range "Sheet2!A1" --values 'Alice,100'
```

Use `--values` for simple single-row appends. Use `--json-values` for bulk multi-row inserts.

> **Write command** — confirm with the user before executing.

## Raw API

```bash
gws sheets <resource> <method> --params '{"key": "val"}' --json '{"key": "val"}'
```

### Common operations

**Create a spreadsheet:**
```bash
gws sheets spreadsheets create --json '{"properties": {"title": "Q1 Budget"}}'
```

**Get spreadsheet metadata:**
```bash
gws sheets spreadsheets get --params '{"spreadsheetId": "SPREADSHEET_ID"}'
```

**Read cell values:**
```bash
gws sheets spreadsheets values get \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1:C10"}'
```

**Write cell values:**
```bash
gws sheets spreadsheets values update \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Name", "Score"], ["Alice", 95], ["Bob", 87]]}'
```

**Append rows (raw API):**
```bash
gws sheets spreadsheets values append \
  --params '{"spreadsheetId": "ID", "range": "Sheet1!A1", "valueInputOption": "USER_ENTERED"}' \
  --json '{"values": [["Charlie", 92]]}'
```

**Clear a range:**
```bash
gws sheets spreadsheets values clear \
  --params '{"spreadsheetId": "SPREADSHEET_ID", "range": "Sheet1!A1:C10"}'
```

**Batch update (add a sheet, formatting, etc.):**
```bash
gws sheets spreadsheets batchUpdate --params '{"spreadsheetId": "SPREADSHEET_ID"}' \
  --json '{"requests": [{"addSheet": {"properties": {"title": "New Tab"}}}]}'
```

> **Write/delete commands** — confirm with the user before executing.

## Shell Tips

Sheets ranges use `!` which zsh interprets as history expansion. Always use **double quotes** around range values:

```bash
# Correct
gws sheets +read --spreadsheet ID --range "Sheet1!A1:D10"

# Wrong (zsh will mangle the !)
gws sheets +read --spreadsheet ID --range 'Sheet1!A1:D10'
```

Wrap `--params` and `--json` values in **single quotes** so the shell doesn't interpret inner double quotes:
```bash
gws sheets spreadsheets values get --params '{"spreadsheetId": "ID", "range": "Sheet1!A1:C10"}'
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <FORMAT>` | Output: `json` (default), `table`, `yaml`, `csv` |
| `--dry-run` | Preview request without calling the API |

## Pagination

| Flag | Description | Default |
|------|-------------|---------|
| `--page-all` | Auto-paginate (NDJSON output) | off |
| `--page-limit <N>` | Max pages | 10 |
| `--page-delay <MS>` | Delay between pages | 100 ms |

## Discovering Methods

```bash
gws sheets --help                              # list all resources and methods
gws schema sheets.spreadsheets.values.get      # inspect params, types, defaults
gws schema sheets.spreadsheets.values.update   # inspect request body schema
gws schema sheets.spreadsheets.batchUpdate     # inspect batch update requests
```

## Security Rules

- **Never** output secrets (API keys, tokens) directly
- **Always** confirm with user before write/delete commands
- Prefer `--dry-run` for destructive operations
