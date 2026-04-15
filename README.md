# agent-things

A personal collection of skills and extensions for coding agents. Feel free to use anything here.

Things here should work for any coding agents, but I primarily use [pi](https://shittycodingagent.ai/), [Claude Code](https://github.com/anthropics/claude-code) and [Codex CLI](https://github.com/openai/codex).

## Prerequisites

- [uv](https://github.com/astral-sh/uv)
- [Node.js](https://nodejs.org/)

## Agent instruction files

This repo keeps my `AGENTS.md` under:

- [`.meta/global/AGENTS.md`](.meta/global/AGENTS.md)

To use this `AGENTS.md` for `pi` and Claude Code:

```bash
ln -sfn "$(pwd)/.meta/global/AGENTS.md" ~/.pi/agent/AGENTS.md
ln -sfn "$(pwd)/.meta/global/AGENTS.md" ~/.claude/CLAUDE.md
```

## Skills

| Skill               | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| [figma](#figma)     | Fetch Figma design data and images                                 |
| [firefox](#firefox) | Firefox browser automation via WebDriver BiDi                      |
| [ocr](#ocr)         | OCR images and PDFs to Markdown using Qwen3.5 VL (Apple Silicon)   |
| [pandoc](#pandoc)   | Convert documents (DOCX, PPTX, ODT, EPUB, RTF) to Markdown        |
| [pencil](#pencil)   | Interface with Pencil.app for `.pen` design files                  |

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

### firefox

Firefox browser automation via WebDriver BiDi. Inspired by [browser-tools](https://github.com/badlogic/pi-skills/tree/main/browser-tools).

```bash
ln -s "$(pwd)/skills/firefox" ~/.pi/agent/skills/
cd skills/firefox && npm install
```

### ocr

OCR images and PDFs to Markdown using [Qwen3.5 VL](https://huggingface.co/mlx-community/Qwen3.5-4B-MLX-4bit) via MLX. Best for scanned documents, photos, complex layouts, and CJK content.

**Requires:** macOS Apple Silicon

```bash
ln -s "$(pwd)/skills/ocr" ~/.pi/agent/skills/
bash skills/ocr/setup.sh  # downloads model (~2.5GB)
```

### pandoc

Convert binary documents (DOCX, PPTX, ODT, ODP, EPUB, RTF) to Markdown using [pandoc](https://pandoc.org/).

```bash
ln -s "$(pwd)/skills/pandoc" ~/.pi/agent/skills/
bash skills/pandoc/setup.sh  # downloads pandoc
```

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
| [usage](#usage)                   | Show Anthropic + OpenAI subscription usage    |

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

### usage

Show usage for the current model provider via `/usage`, or both providers via `/usage all`. Supports Anthropic subscription usage limits (Pro/Max) and OpenAI Codex / ChatGPT subscription usage. Reads OAuth credentials from pi's `auth.json`.

```bash
ln -s "$(pwd)/pi-extensions/usage.ts" ~/.pi/agent/extensions/
```
