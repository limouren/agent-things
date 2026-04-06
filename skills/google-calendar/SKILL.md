---
name: google-calendar
description: "Google Calendar: View agenda, create/edit/delete events, check free/busy, and manage calendars via the gws CLI. Use when working with calendar events or scheduling."
---

# Google Calendar

Manage calendars and events using the `gws` CLI.

## Setup

Run once before first use:

```bash
# Install gws (macOS Apple Silicon)
curl -fsSL https://github.com/googleworkspace/cli/releases/latest/download/gws-darwin-arm64.tar.gz | tar xz
sudo mv gws /usr/local/bin/

# Authenticate (opens browser)
gws auth setup        # first time: creates GCP project, enables APIs, logs in
gws auth login -s calendar   # subsequent logins (select only Calendar scopes)
```

If `gws auth setup` fails (requires `gcloud`), follow the manual OAuth setup:
1. Create a Desktop OAuth client at https://console.cloud.google.com/apis/credentials
2. Download JSON to `~/.config/gws/client_secret.json`
3. Add yourself as a test user in the OAuth consent screen
4. Run `gws auth login`

## Helper Commands

### +agenda — Show upcoming events

```bash
gws calendar +agenda
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--today` | — | — | Show today's events |
| `--tomorrow` | — | — | Show tomorrow's events |
| `--week` | — | — | Show this week's events |
| `--days` | — | — | Number of days ahead to show |
| `--calendar` | — | all | Filter to specific calendar name or ID |
| `--timezone` | — | Google account tz | IANA timezone override (e.g. America/New_York) |

```bash
gws calendar +agenda
gws calendar +agenda --today
gws calendar +agenda --week --format table
gws calendar +agenda --days 3 --calendar 'Work'
gws calendar +agenda --today --timezone America/New_York
```

Read-only. Queries all calendars by default.

### +insert — Create a new event

```bash
gws calendar +insert --summary <TEXT> --start <TIME> --end <TIME>
```

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--summary` | ✓ | — | Event title |
| `--start` | ✓ | — | Start time (ISO 8601, e.g. 2026-04-07T09:00:00-07:00) |
| `--end` | ✓ | — | End time (ISO 8601) |
| `--calendar` | — | primary | Calendar ID |
| `--location` | — | — | Event location |
| `--description` | — | — | Event description/body |
| `--attendee` | — | — | Attendee email (repeatable) |
| `--meet` | — | — | Add a Google Meet link |

```bash
gws calendar +insert --summary 'Standup' \
  --start '2026-04-07T09:00:00-07:00' --end '2026-04-07T09:30:00-07:00'
gws calendar +insert --summary 'Review' \
  --start '2026-04-07T14:00:00-07:00' --end '2026-04-07T15:00:00-07:00' \
  --attendee alice@example.com --meet
```

Use RFC 3339 format for times. The `--meet` flag automatically adds a Google Meet link.

> **Write command** — confirm with the user before executing.

## Raw API

```bash
gws calendar <resource> <method> --params '{"key": "val"}' --json '{"key": "val"}'
```

### Common operations

**List events:**
```bash
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10, "timeMin": "2026-04-05T00:00:00Z", "singleEvents": true, "orderBy": "startTime"}'
```

**Get an event:**
```bash
gws calendar events get --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

**Quick-add an event from text:**
```bash
gws calendar events quickAdd --params '{"calendarId": "primary", "text": "Lunch with Alice tomorrow at noon"}'
```

**Update an event (patch):**
```bash
gws calendar events patch --params '{"calendarId": "primary", "eventId": "EVENT_ID"}' \
  --json '{"summary": "Updated Title", "location": "Room 42"}'
```

**Delete an event:**
```bash
gws calendar events delete --params '{"calendarId": "primary", "eventId": "EVENT_ID"}'
```

**Query free/busy:**
```bash
gws calendar freebusy query --json '{
  "timeMin": "2026-04-07T00:00:00Z",
  "timeMax": "2026-04-07T23:59:59Z",
  "items": [{"id": "alice@example.com"}, {"id": "bob@example.com"}]
}'
```

**List calendars:**
```bash
gws calendar calendarList list
```

**Create a secondary calendar:**
```bash
gws calendar calendars insert --json '{"summary": "Side Project"}'
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
gws calendar --help                        # list all resources and methods
gws schema calendar.events.list            # inspect params, types, defaults
gws schema calendar.events.insert          # inspect request body schema
```

## Security Rules

- **Never** output secrets (API keys, tokens) directly
- **Always** confirm with user before write/delete commands
- Prefer `--dry-run` for destructive operations
