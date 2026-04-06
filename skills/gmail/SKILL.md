---
name: gmail
description: "Gmail: Send, read, reply, forward, triage, and manage email via the gws CLI. Use when working with email — composing, reading, searching, labeling, or watching for new messages."
---

# Gmail

Send, read, search, and manage email using the `gws` CLI.

## Setup

Run once before first use:

```bash
# Install gws (macOS Apple Silicon)
curl -fsSL https://github.com/googleworkspace/cli/releases/latest/download/gws-darwin-arm64.tar.gz | tar xz
sudo mv gws /usr/local/bin/

# Authenticate (opens browser)
gws auth setup        # first time: creates GCP project, enables APIs, logs in
gws auth login -s gmail   # subsequent logins (select only Gmail scopes)
```

If `gws auth setup` fails (requires `gcloud`), follow the manual OAuth setup:
1. Create a Desktop OAuth client at https://console.cloud.google.com/apis/credentials
2. Download JSON to `~/.config/gws/client_secret.json`
3. Add yourself as a test user in the OAuth consent screen
4. Run `gws auth login`

## Helper Commands

### +send — Send an email

```bash
gws gmail +send --to <EMAILS> --subject <SUBJECT> --body <TEXT>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--to` | ✓ | — | Recipient(s), comma-separated |
| `--subject` | ✓ | — | Email subject |
| `--body` | ✓ | — | Email body (plain text, or HTML with --html) |
| `--from` | — | — | Sender alias address |
| `--cc` | — | — | CC recipient(s), comma-separated |
| `--bcc` | — | — | BCC recipient(s), comma-separated |
| `--attach` | — | — | File attachment (repeatable, max 25MB total) |
| `--html` | — | — | Treat --body as HTML (use fragment tags, no wrapper needed) |
| `--draft` | — | — | Save as draft instead of sending |
| `--dry-run` | — | — | Preview without sending |

```bash
gws gmail +send --to alice@example.com --subject 'Hello' --body 'Hi Alice!'
gws gmail +send --to alice@example.com --subject 'Report' --body 'See attached' -a report.pdf
gws gmail +send --to alice@example.com --subject 'HTML' --body '<b>Bold</b> text' --html
gws gmail +send --to alice@example.com --subject 'Draft' --body 'Review this' --draft
```

> **Write command** — confirm with the user before executing.

### +read — Read a message

```bash
gws gmail +read --id <MESSAGE_ID>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--id` | ✓ | — | Gmail message ID |
| `--headers` | — | — | Include From, To, Subject, Date headers |
| `--html` | — | — | Return HTML body instead of plain text |
| `--format` | — | text | Output format: text, json |

```bash
gws gmail +read --id 18f1a2b3c4d
gws gmail +read --id 18f1a2b3c4d --headers
gws gmail +read --id 18f1a2b3c4d --format json | jq '.body'
```

### +reply — Reply to a message

```bash
gws gmail +reply --message-id <ID> --body <TEXT>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--message-id` | ✓ | — | Gmail message ID to reply to |
| `--body` | ✓ | — | Reply body |
| `--from` | — | — | Sender alias |
| `--to` | — | — | Additional To recipients |
| `--cc` | — | — | CC recipients |
| `--bcc` | — | — | BCC recipients |
| `--attach` | — | — | File attachment (repeatable) |
| `--html` | — | — | HTML body |
| `--draft` | — | — | Save as draft |

```bash
gws gmail +reply --message-id 18f1a2b3c4d --body 'Thanks, got it!'
gws gmail +reply --message-id 18f1a2b3c4d --body 'Looping in Carol' --cc carol@example.com
```

Automatically sets In-Reply-To, References, and threadId headers and quotes the original message.

> **Write command** — confirm with the user before executing.

### +reply-all — Reply to all recipients

```bash
gws gmail +reply-all --message-id <ID> --body <TEXT>
```

Same flags as `+reply`, plus:

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--remove` | — | — | Exclude recipients from reply (comma-separated emails) |

```bash
gws gmail +reply-all --message-id 18f1a2b3c4d --body 'Sounds good!'
gws gmail +reply-all --message-id 18f1a2b3c4d --body 'Updated' --remove bob@example.com
```

> **Write command** — confirm with the user before executing.

### +forward — Forward a message

```bash
gws gmail +forward --message-id <ID> --to <EMAILS>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--message-id` | ✓ | — | Gmail message ID to forward |
| `--to` | ✓ | — | Recipient(s) |
| `--body` | — | — | Note above the forwarded message |
| `--cc` | — | — | CC recipients |
| `--bcc` | — | — | BCC recipients |
| `--attach` | — | — | Extra file attachments (repeatable) |
| `--no-original-attachments` | — | — | Exclude original attachments |
| `--html` | — | — | HTML body |
| `--draft` | — | — | Save as draft |

```bash
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com
gws gmail +forward --message-id 18f1a2b3c4d --to dave@example.com --body 'FYI see below'
```

Original attachments are included by default. Use `--no-original-attachments` to exclude them.

> **Write command** — confirm with the user before executing.

### +triage — Inbox summary

```bash
gws gmail +triage
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--max` | — | 20 | Maximum messages to show |
| `--query` | — | is:unread | Gmail search query |
| `--labels` | — | — | Include label names in output |

```bash
gws gmail +triage
gws gmail +triage --max 5 --query 'from:boss'
gws gmail +triage --format json | jq '.[].subject'
```

Read-only. Defaults to table output.

### +watch — Watch for new emails

```bash
gws gmail +watch --project <GCP_PROJECT>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--project` | — | — | GCP project ID for Pub/Sub |
| `--subscription` | — | — | Existing Pub/Sub subscription (skip setup) |
| `--label-ids` | — | — | Filter by label IDs (e.g. INBOX,UNREAD) |
| `--max-messages` | — | 10 | Max messages per pull batch |
| `--poll-interval` | — | 5 | Seconds between pulls |
| `--once` | — | — | Pull once and exit |
| `--cleanup` | — | — | Delete Pub/Sub resources on exit |
| `--output-dir` | — | — | Write each message to a JSON file |

```bash
gws gmail +watch --project my-gcp-project
gws gmail +watch --project my-project --label-ids INBOX --once
```

**Note:** Requires Pub/Sub setup in your GCP project. Gmail watch expires after 7 days — re-run to renew.

## Raw API

```bash
gws gmail <resource> <method> --params '{"key": "val"}' --json '{"key": "val"}'
```

### Common operations

**List messages:**
```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 10}'
gws gmail users messages list --params '{"userId": "me", "q": "from:alice subject:report"}'
```

**Get a message:**
```bash
gws gmail users messages get --params '{"userId": "me", "id": "MESSAGE_ID"}'
```

**List threads:**
```bash
gws gmail users threads list --params '{"userId": "me", "maxResults": 10}'
```

**List labels:**
```bash
gws gmail users labels list --params '{"userId": "me"}'
```

**Create a label:**
```bash
gws gmail users labels create --params '{"userId": "me"}' \
  --json '{"name": "My Label", "labelListVisibility": "labelShow"}'
```

**Modify message labels:**
```bash
gws gmail users messages modify --params '{"userId": "me", "id": "MSG_ID"}' \
  --json '{"addLabelIds": ["LABEL_ID"], "removeLabelIds": ["INBOX"]}'
```

**Trash / untrash a message:**
```bash
gws gmail users messages trash --params '{"userId": "me", "id": "MSG_ID"}'
gws gmail users messages untrash --params '{"userId": "me", "id": "MSG_ID"}'
```

**Create a filter:**
```bash
gws gmail users settings filters create --params '{"userId": "me"}' \
  --json '{"criteria": {"from": "noreply@example.com"}, "action": {"addLabelIds": ["LABEL_ID"], "removeLabelIds": ["INBOX"]}}'
```

**Get profile:**
```bash
gws gmail users getProfile --params '{"userId": "me"}'
```

> **Write/delete commands** — confirm with the user before executing.

## Pagination

| Flag | Description | Default |
|------|-------------|---------|
| `--page-all` | Auto-paginate (NDJSON output) | off |
| `--page-limit <N>` | Max pages | 10 |
| `--page-delay <MS>` | Delay between pages | 100 ms |

## Global Flags

| Flag | Description |
|------|-------------|
| `--format <FORMAT>` | Output: `json` (default), `table`, `yaml`, `csv` |
| `--dry-run` | Preview request without calling the API |

## Discovering Methods

```bash
gws gmail --help                        # list all resources and methods
gws schema gmail.users.messages.list    # inspect params, types, defaults
gws schema gmail.users.labels.create    # inspect request body schema
```

## Security Rules

- **Never** output secrets (API keys, tokens) directly
- **Always** confirm with user before write/delete commands
- Prefer `--dry-run` for destructive operations
