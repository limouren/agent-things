# agent-things

A personal collection of skills and extensions for coding agents. Feel free to use anything here.

Things here should work for any coding agents, but I primarily use [pi](https://shittycodingagent.ai/), [Claude Code](https://github.com/anthropics/claude-code) and [Codex CLI](https://github.com/openai/codex).

## Prerequisites

- [uv](https://github.com/astral-sh/uv)
- [Node.js](https://nodejs.org/)

## Skills

| Skill                               | Description                                                   |
| ----------------------------------- | ------------------------------------------------------------- |
| [read-url](#read-url)               | Convert web pages to markdown                                 |
| [doc-to-markdown](#doc-to-markdown) | Convert documents (PDF, DOCX, PPTX, XLSX, images) to markdown |
| [figma](#figma)                     | Fetch Figma design data and images                            |
| [pencil](#pencil)                   | Interface with Pencil.app for `.pen` design files             |

### read-url

Convert web pages to clean markdown using Jina Reader API.

```bash
ln -s "$(pwd)/skills/read-url" ~/.pi/agent/skills/
```

### doc-to-markdown

Convert documents (PDF, DOCX, PPTX, XLSX, images) to markdown using [marker](https://github.com/datalab-to/marker).

Prerequisites:

- `pango` (macOS only, for XLSX support)

```bash
ln -s "$(pwd)/skills/doc-to-markdown" ~/.pi/agent/skills/
cd skills/doc-to-markdown && uv sync
```

First run downloads ML models (~2GB).

### figma

Fetch Figma design data and download images.

```bash
ln -s "$(pwd)/skills/figma" ~/.pi/agent/skills/

# Install dependencies
cd skills/figma && npm install

# Configure API key
echo '{"apiKey": "figd_YOUR_KEY"}' > skills/figma/config.json
```

Get an API key at: https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens

### pencil

Interface with [Pencil.dev](https://www.pencil.dev/) to read, create, and modify `.pen` design files.

```bash
ln -s "$(pwd)/skills/pencil" ~/.pi/agent/skills/

# Install dependencies
cd skills/pencil && npm install
```

Requires Pencil.app to be running.

## Extensions

Extensions for [pi](https://github.com/mariozechner/pi-coding-agent).

| Extension                         | Description                                   |
| --------------------------------- | --------------------------------------------- |
| [notify-on-idle](#notify-on-idle) | Desktop notifications when pi completes tasks |
| [sandbox](#sandbox)               | OS-level sandboxing for bash commands         |

### notify-on-idle

Desktop notifications when pi completes tasks while the terminal is unfocused.

Prerequisites:

- `terminal-notifier` (macOS)

```bash
ln -s "$(pwd)/pi-extensions/notify-on-idle.ts" ~/.pi/agent/extensions/
ln -s "$(pwd)/pi-extensions/assets" ~/.pi/agent/extensions/
```

### sandbox

OS-level sandboxing for bash commands. Stolen from [pi examples](https://github.com/mariozechner/pi-coding-agent/tree/main/examples/extensions/sandbox).

**Difference from stock**: Sandbox is disabled by default. Use `--sandbox` to enable, or set `enabled: true` in config.

Prerequisites:

- `ripgrep` (rg)
- `bubblewrap` (bwrap, Linux only)
- `socat` (Linux only)

```bash
ln -s "$(pwd)/pi-extensions/sandbox" ~/.pi/agent/extensions/
cd pi-extensions/sandbox && npm install
```
