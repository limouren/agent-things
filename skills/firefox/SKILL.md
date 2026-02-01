---
name: firefox
description: Firefox browser automation via WebDriver BiDi. Use when you need to interact with web pages using Firefox, test frontends, or when user interaction with a visible browser is required.
---

# Firefox Browser Tools

Firefox WebDriver BiDi tools for agent-assisted web automation. These tools connect to Firefox running on `:9222` with remote debugging enabled.

## Setup

Run once before first use:

```bash
cd {baseDir}
npm install
```

## Start Firefox

```bash
{baseDir}/firefox-start.js              # Copy user's profile (cookies, logins)
{baseDir}/firefox-start.js --no-profile # Fresh profile
```

Launch Firefox with WebDriver BiDi on `:9222`. By default, copies the user's profile to preserve authentication state. Use `--no-profile` for a clean session.

## Navigate

```bash
{baseDir}/firefox-nav.js https://example.com
{baseDir}/firefox-nav.js https://example.com --new
```

Navigate to URLs. Use `--new` flag to open in a new tab instead of reusing current tab.

## Evaluate JavaScript

```bash
{baseDir}/firefox-eval.js 'document.title'
{baseDir}/firefox-eval.js 'document.querySelectorAll("a").length'
```

Execute JavaScript in the active tab. Code runs in async context. Use this to extract data, inspect page state, or perform DOM operations programmatically.

## Screenshot

```bash
{baseDir}/firefox-screenshot.js
```

Capture current viewport and return temporary file path. Use this to visually inspect page state or verify UI changes.

## Cookies

```bash
{baseDir}/firefox-cookies.js
```

Display all cookies for the current tab including domain, path, httpOnly, and secure flags. Use this to debug authentication issues or inspect session state.

## Pick Elements

```bash
{baseDir}/firefox-pick.js 'Click the close button'
{baseDir}/firefox-pick.js 'Select the upload area'
```

Ask the user to click on element(s) in the Firefox window. Shows a highlight overlay and banner with instructions. Single click selects one element, Cmd/Ctrl+click to multi-select, Enter to finish, ESC to cancel. Returns element info (tag, id, class, text, html, parents). Use this when you need the user to identify which element to interact with.

## Upload Files

```bash
{baseDir}/firefox-upload.js '/path/to/file'
```

Upload a file via the page's file input. Sets up a file chooser listener, clicks the "Upload Files" button, and accepts the file. Use this to upload files through file picker dialogs.

## Extract Page Content

```bash
{baseDir}/firefox-content.js https://example.com
```

Navigate to a URL and extract readable content as markdown. Uses Mozilla Readability for article extraction and Turndown for HTML-to-markdown conversion. Works on pages with JavaScript content (waits for page to load).

## When to Use

- Testing frontend code in a real browser
- Interacting with pages that require JavaScript
- When user needs to visually see or interact with a page
- Debugging authentication or session issues
- Scraping dynamic content that requires JS execution
- When Firefox-specific behavior is needed
