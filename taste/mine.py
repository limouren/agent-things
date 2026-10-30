#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Collect user replies from pi sessions into the taste inbox."""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

USER_TEXT_LIMIT = 2000
AGENT_HEAD = 500
AGENT_TAIL = 1000

# Plain approvals carry no taste, so they only cost judge context.
APPROVAL = re.compile(
    r"^(y(es|ea|eah|ep)?|ok(ay)?|k|sure|go( ahead)?|continue|done|ready|try again|"
    r"thanks?( you)?|lgtm|\d+|option \w|let'?s go with \w+)"
    r"([ ,.!]+(y(es|ea)?|ok(ay)?|please|go ahead|continue|try again|thanks?))*[ .!]*$",
    re.IGNORECASE,
)


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text")
    return ""


def excerpt(text: str) -> str:
    if len(text) <= AGENT_HEAD + AGENT_TAIL:
        return text
    return f"{text[:AGENT_HEAD]}\n[…]\n{text[-AGENT_TAIL:]}"


def project_of(cwd: str) -> str:
    if not cwd:
        return cwd
    home = Path.home().resolve()
    path = Path(cwd).resolve()
    if path == home:
        return "~"
    if not path.is_relative_to(home):
        return cwd
    return str(path.relative_to(home))


def read_session(path: Path, start: str, end: str):
    entries, header = {}, {}
    for line in path.open(errors="replace"):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if entry.get("type") == "session":
            header = entry
        elif "id" in entry:
            entries[entry["id"]] = entry

    for entry in entries.values():
        message = entry.get("message")
        if entry.get("type") != "message" or not isinstance(message, dict) or message.get("role") != "user":
            continue
        if not (start < entry.get("timestamp", "") <= end):
            continue
        user_text = text_of(message.get("content")).strip()
        if not user_text or APPROVAL.match(user_text):
            continue

        agent_text, parent = "", entries.get(entry.get("parentId"))
        while parent is not None:
            parent_message = parent.get("message")
            if isinstance(parent_message, dict) and parent_message.get("role") == "assistant":
                agent_text = text_of(parent_message.get("content")).strip()
                if agent_text:
                    break
            parent = entries.get(parent.get("parentId"))

        yield {
            "id": f"{header.get('id', path.stem)}:{entry['id']}",
            "ts": entry["timestamp"],
            "project": project_of(header.get("cwd", "")),
            "agent": excerpt(agent_text),
            "user": user_text[:USER_TEXT_LIMIT],
        }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True, help="taste data repository")
    parser.add_argument("--host", required=True)
    parser.add_argument("--sessions", type=Path, default=Path.home() / ".pi/agent/sessions")
    parser.add_argument("--since", help="ISO timestamp to start from when the host has no cursor yet")
    args = parser.parse_args()

    cursor_path = args.repo / "cursor" / f"{args.host}.json"
    end = utc_now()
    if cursor_path.exists():
        start = json.loads(cursor_path.read_text())["until"]
    else:
        start = args.since or end

    start_epoch = datetime.fromisoformat(start.replace("Z", "+00:00")).timestamp()
    found = []
    for path in args.sessions.glob("*/*.jsonl"):
        if path.stat().st_mtime >= start_epoch:
            found.extend(read_session(path, start, end))

    for item in sorted(found, key=lambda item: item["ts"]):
        inbox = args.repo / "inbox" / args.host / f"{item['ts'][:7]}.jsonl"
        inbox.parent.mkdir(parents=True, exist_ok=True)
        with inbox.open("a") as file:
            file.write(json.dumps({"host": args.host, **item}, ensure_ascii=False) + "\n")

    cursor_path.parent.mkdir(parents=True, exist_ok=True)
    cursor_path.write_text(json.dumps({"until": end}) + "\n")
    print(f"{args.host}: {len(found)} replies from {start} to {end}")


if __name__ == "__main__":
    main()
