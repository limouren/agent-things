# taste

Updates the global `AGENTS.md` from the corrections you give pi in your sessions. Nothing needs your review: the judge commits and pushes each change.

## How it works

1. `run.sh mine` collects your new replies from the pi sessions on this machine. Each reply is stored with the agent message it answers. It adds them to a private data repository, then pulls the latest `AGENTS.md` into this checkout.
2. `run.sh judge` mines, then runs pi with `judge.md` on the replies that have not been judged. pi adds a principle only when you gave the same correction in 3 or more projects. It then commits and pushes `AGENTS.md`, and logs each decision in the data repository.

The data repository holds:

- `inbox/<host>/<month>.jsonl`: replies from each machine
- `cursor/<host>.json`: the time up to which each machine was mined
- `decisions.jsonl`: each principle that the judge added, revised, merged or watched, with the reason
- `state/judged.txt`: the IDs of judged replies

Keep the data repository private. The replies contain code and project details.

## Setup

1. Clone the private data repository to `~/agent-taste`, or set `TASTE_REPO`.
2. Set `TASTE_HOST` to a short, unique name for each machine.
3. Run `run.sh mine` on a schedule on each machine, and run `run.sh judge` on a schedule on one machine.

To include earlier sessions on the first run, call `mine.py` once with `--since <ISO timestamp>`.

To remove a principle, delete it from `AGENTS.md`. The judge treats a removed principle as rejected and does not add it again.
