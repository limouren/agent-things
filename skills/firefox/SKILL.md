---
name: firefox
description: Firefox browser automation via WebDriver BiDi. Use when you need to interact with web pages using Firefox, test frontends, or when user interaction with a visible browser is required.
---

# Firefox Browser Tools

Interactive commands share one visible Firefox session. Content extraction uses a separate, automatically managed headless Firefox session.

## Setup

Run once before first use:

```bash
cd {baseDir}
npm install
```

## Interactive Firefox

```bash
{baseDir}/firefox-start.js                  # Copy the default Firefox profile
{baseDir}/firefox-start.js --profile Work   # Copy a named profile
{baseDir}/firefox-start.js --no-profile     # Start with a clean profile
{baseDir}/firefox-stop.js                   # Stop Firefox
```

Firefox stays running and processes browser operations in order. Commands report an error if it has not been started.

### Navigate

```bash
{baseDir}/firefox-nav.js https://example.com
{baseDir}/firefox-nav.js https://example.com --new
```

### Evaluate JavaScript

```bash
{baseDir}/firefox-eval.js 'document.title'
{baseDir}/firefox-eval.js 'document.querySelectorAll("a").length'
```

Code runs in an async function in the active tab.

### Screenshot

```bash
{baseDir}/firefox-screenshot.js
```

Prints the path to a temporary PNG screenshot of the active tab.

### Cookies

```bash
{baseDir}/firefox-cookies.js
```

### Pick Elements

```bash
{baseDir}/firefox-pick.js 'Click the close button'
```

The user can click one element, Cmd/Ctrl+click several elements, press Enter to finish, or press Escape to cancel.

### Upload a File

```bash
{baseDir}/firefox-upload.js /path/to/file
```

## Headless Content Extraction

```bash
{baseDir}/firefox-content.js https://example.com
```

`firefox-content.js` automatically manages a dedicated headless Firefox. Requests share one Firefox process but use isolated browser contexts. Up to four requests run concurrently by default. Firefox closes and removes its private profile after 60 seconds without active work.

Configuration:

- `FIREFOX_CONTENT_CONCURRENCY`: maximum concurrent pages; default `4`
- `FIREFOX_CONTENT_IDLE_MS`: idle shutdown delay; default `60000`
- `FIREFOX_CONTENT_TIMEOUT_MS`: extraction timeout; default `60000`

The visible and headless Firefox sessions are independent, so content extraction cannot affect interactive browsing.
