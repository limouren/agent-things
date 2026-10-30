#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///
"""Let pi judge pending inbox replies and update the public AGENTS.md."""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

AGENTS_MD = ".meta/global/AGENTS.md"
JUDGE_PROMPT = Path(__file__).with_name("judge.md")
MAX_LINE_WORDS = 20
MAX_FILE_WORDS = 320


def git(repo: Path, *args: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, text=True).stdout


def changed_paths(repo: Path) -> set[str]:
    return {line[3:] for line in git(repo, "status", "--porcelain", "--untracked-files=all").splitlines()}


def discard_changes(repo: Path) -> None:
    git(repo, "reset", "--hard", "--quiet")
    git(repo, "clean", "-fd", "--quiet")


def length_problems(agents_md: Path) -> list[str]:
    lines = [line.removeprefix("- ") for line in agents_md.read_text().splitlines() if line.strip()]
    problems = [f"{len(line.split())} words: {line}" for line in lines if len(line.split()) > MAX_LINE_WORDS]
    total = sum(len(line.split()) for line in lines)
    if total > MAX_FILE_WORDS:
        problems.append(f"{total} words in the file")
    return problems


def push(repo: Path) -> None:
    git(repo, "pull", "--rebase", "--quiet")
    git(repo, "push", "--quiet")


def pending_batches(repo: Path, batch_chars: int) -> list[list[dict]]:
    judged_path = repo / "state" / "judged.txt"
    judged = set(judged_path.read_text().split()) if judged_path.exists() else set()
    pending = sorted(
        (
            entry
            for path in (repo / "inbox").glob("*/*.jsonl")
            for entry in map(json.loads, path.open())
            if entry["id"] not in judged
        ),
        key=lambda entry: entry["ts"],
    )

    batches, batch, size = [], [], 0
    for entry in pending:
        entry_size = len(json.dumps(entry, ensure_ascii=False))
        if batch and size + entry_size > batch_chars:
            batches.append(batch)
            batch, size = [], 0
        batch.append(entry)
        size += entry_size
    if batch:
        batches.append(batch)
    return batches


def judge(repo: Path, agent_things: Path, batch: list[dict], model: str) -> None:
    with tempfile.TemporaryDirectory(prefix="taste-") as tmp:
        batch_path = Path(tmp) / "batch.jsonl"
        message_path = Path(tmp) / "commit-message.txt"
        batch_path.write_text("".join(json.dumps(entry, ensure_ascii=False) + "\n" for entry in batch))

        task = "\n".join([
            "Judge this batch.",
            f"- Batch file: {batch_path}",
            f"- Inbox directory: {repo / 'inbox'}",
            f"- AGENTS.md: {agent_things / AGENTS_MD}",
            f"- decisions.jsonl: {repo / 'decisions.jsonl'}",
            f"- Commit message path: {message_path}",
            f"- Word limits: {MAX_LINE_WORDS} words per line, {MAX_FILE_WORDS} words in AGENTS.md",
        ])
        try:
            subprocess.run(
                [
                    "pi", "-p", "--model", model, "--no-session", "--no-context-files",
                    "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-approve",
                    "--append-system-prompt", str(JUDGE_PROMPT), task,
                ],
                cwd=repo,
                check=True,
            )
        except subprocess.CalledProcessError as error:
            discard_changes(agent_things)
            discard_changes(repo)
            sys.exit(f"Judge failed with exit status {error.returncode}; discarded partial changes. Rerun to resume.")

        unexpected = (changed_paths(agent_things) - {AGENTS_MD}) | (changed_paths(repo) - {"decisions.jsonl"})
        if unexpected:
            discard_changes(agent_things)
            discard_changes(repo)
            sys.exit(f"Judge changed unexpected files: {sorted(unexpected)}")

        too_long = length_problems(agent_things / AGENTS_MD)
        if too_long:
            discard_changes(agent_things)
            discard_changes(repo)
            sys.exit("Judge exceeded the AGENTS.md word limits:\n" + "\n".join(too_long))

        if changed_paths(agent_things):
            message = message_path.read_text() if message_path.exists() else "AGENTS.md: Update from taste review\n"
            subprocess.run(
                ["git", "-C", str(agent_things), "commit", "--quiet", "-F", "-", "--", AGENTS_MD],
                input=message, text=True, check=True,
            )
            push(agent_things)

    with (repo / "state" / "judged.txt").open("a") as judged:
        judged.write("".join(entry["id"] + "\n" for entry in batch))
    git(repo, "add", "decisions.jsonl", "state/judged.txt")
    git(repo, "commit", "--quiet", "-m", f"Judge {len(batch)} replies up to {batch[-1]['ts']}")
    push(repo)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True, help="taste data repository")
    parser.add_argument("--agent-things", type=Path, required=True, help="clone used only by the judge")
    parser.add_argument("--model", default="openai/gpt-6.1-sol:high")
    parser.add_argument("--batch-chars", type=int, default=120_000)
    parser.add_argument("--max-batches", type=int, default=None)
    args = parser.parse_args()

    (args.repo / "state").mkdir(exist_ok=True)
    (args.repo / "decisions.jsonl").touch()
    git(args.agent_things, "pull", "--ff-only", "--quiet")

    batches = pending_batches(args.repo, args.batch_chars)[: args.max_batches]
    for number, batch in enumerate(batches, 1):
        print(f"Batch {number}/{len(batches)}: {len(batch)} replies up to {batch[-1]['ts']}", flush=True)
        judge(args.repo, args.agent_things, batch, args.model)


if __name__ == "__main__":
    main()
