#!/usr/bin/env bash
# Usage: run.sh mine|judge
#   mine   Add new pi replies from this host to the taste repository.
#   judge  Mine, then let pi update AGENTS.md from the pending replies.

set -euo pipefail

TASTE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASTE_REPO="${TASTE_REPO:-$HOME/agent-taste}"
TASTE_HOST="${TASTE_HOST:-$(hostname -s)}"
LIVE_AGENT_THINGS="$(dirname "$TASTE_DIR")"
JUDGE_AGENT_THINGS="${XDG_STATE_HOME:-$HOME/.local/state}/agent-taste/agent-things"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >&2
}

mine() {
    git -C "$TASTE_REPO" pull --rebase --quiet
    "$TASTE_DIR/mine.py" --repo "$TASTE_REPO" --host "$TASTE_HOST"
    git -C "$TASTE_REPO" add inbox cursor
    if ! git -C "$TASTE_REPO" diff --cached --quiet; then
        git -C "$TASTE_REPO" commit --quiet -m "Mine $TASTE_HOST"
        git -C "$TASTE_REPO" pull --rebase --quiet
        git -C "$TASTE_REPO" push --quiet
    fi
}

# Pull judged rules into the live checkout. This fails safely when local work conflicts.
pull_live() {
    git -C "$LIVE_AGENT_THINGS" pull --ff-only --quiet ||
        log "Skipped pulling $LIVE_AGENT_THINGS"
}

judge() {
    if [[ ! -d "$JUDGE_AGENT_THINGS" ]]; then
        git clone --quiet "$(git -C "$LIVE_AGENT_THINGS" remote get-url origin)" "$JUDGE_AGENT_THINGS"
    fi
    "$TASTE_DIR/judge.py" --repo "$TASTE_REPO" --agent-things "$JUDGE_AGENT_THINGS"
}

case "${1:-}" in
    mine)
        mine
        pull_live
        ;;
    judge)
        mine
        judge
        pull_live
        ;;
    *)
        echo "Usage: $0 mine|judge" >&2
        exit 2
        ;;
esac
