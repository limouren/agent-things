---
name: google-drive
description: "Google Drive: Manage files, folders, and shared drives via the gws CLI. Use when uploading, downloading, listing, searching, sharing, or organizing files in Google Drive."
---

# Google Drive

Manage files, folders, and shared drives using the `gws` CLI.

## Setup

Run once before first use:

```bash
# Install gws (macOS Apple Silicon)
curl -fsSL https://github.com/googleworkspace/cli/releases/latest/download/gws-darwin-arm64.tar.gz | tar xz
sudo mv gws /usr/local/bin/

# Authenticate (opens browser)
gws auth setup        # first time: creates GCP project, enables APIs, logs in
gws auth login -s drive   # subsequent logins (select only Drive scopes)
```

If `gws auth setup` fails (requires `gcloud`), follow the manual OAuth setup:
1. Create a Desktop OAuth client at https://console.cloud.google.com/apis/credentials
2. Download JSON to `~/.config/gws/client_secret.json`
3. Add yourself as a test user in the OAuth consent screen
4. Run `gws auth login`

## Helper Commands

### +upload — Upload a file

```bash
gws drive +upload <file> [flags]
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `<file>` | ✓ | — | Path to file to upload |
| `--parent` | — | — | Parent folder ID |
| `--name` | — | source filename | Target filename |

```bash
gws drive +upload ./report.pdf
gws drive +upload ./report.pdf --parent FOLDER_ID
gws drive +upload ./data.csv --name 'Sales Data.csv'
```

> **Write command** — confirm with the user before executing.

## Raw API

```bash
gws drive <resource> <method> --params '{"key": "val"}' --json '{"key": "val"}'
```

### Common operations

**List files:**
```bash
gws drive files list --params '{"pageSize": 10}'
gws drive files list --params '{"q": "name contains '\''report'\''", "pageSize": 20}'
gws drive files list --params '{"q": "mimeType = '\''application/vnd.google-apps.folder'\''"}' 
```

**Get file metadata:**
```bash
gws drive files get --params '{"fileId": "FILE_ID", "fields": "id,name,mimeType,size,webViewLink"}'
```

**Download a file:**
```bash
gws drive files get --params '{"fileId": "FILE_ID", "alt": "media"}' -o ./downloaded-file.pdf
```

**Export Google Docs/Sheets as PDF:**
```bash
gws drive files export --params '{"fileId": "FILE_ID", "mimeType": "application/pdf"}' -o ./export.pdf
```

**Create a folder:**
```bash
gws drive files create --json '{"name": "New Folder", "mimeType": "application/vnd.google-apps.folder"}'
```

**Move a file to a folder:**
```bash
gws drive files update --params '{"fileId": "FILE_ID", "addParents": "FOLDER_ID", "removeParents": "OLD_PARENT_ID"}'
```

**Copy a file:**
```bash
gws drive files copy --params '{"fileId": "FILE_ID"}' --json '{"name": "Copy of File"}'
```

**Delete a file:**
```bash
gws drive files delete --params '{"fileId": "FILE_ID"}'
```

> **Write/delete commands** — confirm with the user before executing.

**Share a file:**
```bash
gws drive permissions create --params '{"fileId": "FILE_ID"}' \
  --json '{"role": "reader", "type": "user", "emailAddress": "alice@example.com"}'
```

**List permissions:**
```bash
gws drive permissions list --params '{"fileId": "FILE_ID"}'
```

**Search query syntax:** The `q` parameter supports operators like `name contains`, `mimeType =`, `trashed = false`, `parents in`, `modifiedTime >`. Combine with `and`/`or`.

## Pagination

| Flag | Description | Default |
|------|-------------|---------|
| `--page-all` | Auto-paginate (NDJSON, one JSON object per page) | off |
| `--page-limit <N>` | Max pages to fetch | 10 |
| `--page-delay <MS>` | Delay between pages | 100 ms |

```bash
gws drive files list --params '{"pageSize": 100}' --page-all | jq -r '.files[].name'
```

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <FORMAT>` | Output: `json` (default), `table`, `yaml`, `csv` |
| `--dry-run` | Preview request without calling the API |

## Discovering Methods

```bash
gws drive --help                          # list all resources and methods
gws schema drive.files.list               # inspect params, types, defaults
gws schema drive.permissions.create       # inspect request body schema
```

## Security Rules

- **Never** output secrets (API keys, tokens) directly
- **Always** confirm with user before write/delete commands
- Prefer `--dry-run` for destructive operations
