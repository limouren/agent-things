import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, matchesKey } from "@mariozechner/pi-tui";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const BETA_HEADER = "oauth-2025-04-20";

// ── Types ──────────────────────────────────────────────────────

interface UsageBucket {
  utilization: number | null;
  resets_at: string;
}

interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

interface UsageResponse {
  five_hour?: UsageBucket | null;
  seven_day?: UsageBucket | null;
  seven_day_sonnet?: UsageBucket | null;
  seven_day_opus?: UsageBucket | null;
  seven_day_oauth_apps?: UsageBucket | null;
  seven_day_cowork?: UsageBucket | null;
  extra_usage?: ExtraUsage | null;
  [key: string]: unknown;
}

interface DisplayRow {
  label: string;
  utilization: number;
  resetStr: string;
}

// ── Constants ──────────────────────────────────────────────────

const BUCKET_LABELS: Record<string, string> = {
  five_hour: "Current session",
  seven_day: "Current week (all models)",
  seven_day_sonnet: "Current week (Sonnet)",
  seven_day_opus: "Current week (Opus)",
  seven_day_oauth_apps: "Current week (OAuth apps)",
  seven_day_cowork: "Current week (Cowork)",
};

// ── Formatting helpers ─────────────────────────────────────────

function formatResetTime(resetsAt: string): string {
  const now = new Date();
  const reset = new Date(resetsAt);

  const hours = reset.getHours();
  const minutes = reset.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  const h = hours % 12 || 12;
  const timeStr = minutes === 0 ? `${h}${ampm}` : `${h}:${String(minutes).padStart(2, "0")}${ampm}`;

  if (now.toDateString() === reset.toDateString()) {
    return `resets ${timeStr}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.toDateString() === reset.toDateString()) {
    return `resets tomorrow, ${timeStr}`;
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `resets ${months[reset.getMonth()]} ${reset.getDate()}, ${timeStr}`;
}

function barColor(utilization: number): "success" | "warning" | "error" {
  if (utilization > 80) return "error";
  if (utilization > 50) return "warning";
  return "success";
}

// ── Auth ───────────────────────────────────────────────────────

function getAuthDir(): string {
  return process.env.PI_CODING_AGENT_DIR || join(process.env.HOME || "~", ".pi", "agent");
}

function readAccessToken(): { token: string | null; expired: boolean; error: string | null } {
  const authPath = join(getAuthDir(), "auth.json");
  try {
    const raw = readFileSync(authPath, "utf-8");
    const auth = JSON.parse(raw);
    const anthropic = auth?.anthropic;
    if (!anthropic || !anthropic.access) {
      return { token: null, expired: false, error: "No Anthropic credentials found. Use /login to sign in with your subscription." };
    }
    const expired = typeof anthropic.expires === "number" && anthropic.expires < Date.now();
    return { token: anthropic.access, expired, error: null };
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return { token: null, expired: false, error: "Not logged in. Use /login to sign in with your Anthropic subscription." };
    }
    return { token: null, expired: false, error: `Failed to read auth: ${e.message}` };
  }
}

// ── Data processing ────────────────────────────────────────────

function processUsageData(data: UsageResponse): { rows: DisplayRow[]; extraLine: string | null } {
  const rows: DisplayRow[] = [];

  for (const [key, label] of Object.entries(BUCKET_LABELS)) {
    const bucket = data[key] as UsageBucket | null | undefined;
    if (!bucket || bucket.utilization === null || bucket.utilization === undefined) continue;
    rows.push({
      label,
      utilization: bucket.utilization,
      resetStr: formatResetTime(bucket.resets_at),
    });
  }

  let extraLine: string | null = null;
  const extra = data.extra_usage;
  if (extra) {
    if (extra.is_enabled && extra.monthly_limit !== null && extra.used_credits !== null) {
      const used = (extra.used_credits / 100).toFixed(2);
      const limit = (extra.monthly_limit / 100).toFixed(2);
      const pct = extra.utilization !== null ? ` (${Math.round(extra.utilization)}%)` : "";
      extraLine = `$${used} / $${limit} spent${pct}`;
    } else {
      extraLine = "disabled";
    }
  }

  return { rows, extraLine };
}

// ── Plain text fallback (non-interactive) ──────────────────────

function formatPlain(rows: DisplayRow[], extraLine: string | null): string {
  const lines: string[] = ["Anthropic Usage", "─".repeat(60)];
  const maxLabel = Math.max(...rows.map((r) => r.label.length), "Extra usage".length);
  const barWidth = 25;

  for (const r of rows) {
    const filled = Math.round((r.utilization / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const pct = `${String(Math.round(r.utilization)).padStart(3)}%`;
    lines.push(`${r.label.padEnd(maxLabel)}  ${bar}  ${pct}  ${r.resetStr}`);
  }

  if (extraLine !== null) {
    lines.push(`${"Extra usage".padEnd(maxLabel)}  ${extraLine}`);
  }

  return lines.join("\n");
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Show Anthropic subscription usage limits",
    handler: async (_args, ctx) => {
      const { token, expired, error } = readAccessToken();

      if (error || !token) {
        ctx.ui.notify(error || "No access token available.", "error");
        return;
      }

      if (expired) {
        ctx.ui.notify("Warning: OAuth token may be expired. Trying anyway...", "warning");
      }

      // Fetch usage data
      let data: UsageResponse;
      try {
        const res = await fetch(USAGE_ENDPOINT, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "anthropic-beta": BETA_HEADER,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (res.status === 401) {
          ctx.ui.notify("Session expired. Run /login to re-authenticate.", "error");
          return;
        }

        if (!res.ok) {
          const body = await res.text();
          ctx.ui.notify(`API error (${res.status}): ${body}`, "error");
          return;
        }

        data = await res.json();
      } catch (e: any) {
        ctx.ui.notify(`Network error: ${e.message}`, "error");
        return;
      }

      if (Object.keys(data).length === 0) {
        ctx.ui.notify("Usage data is only available for subscription plans (Pro/Max).", "warning");
        return;
      }

      const { rows, extraLine } = processUsageData(data);

      if (rows.length === 0 && extraLine === null) {
        ctx.ui.notify("Usage data is only available for subscription plans (Pro/Max).", "warning");
        return;
      }

      // Interactive: themed bar chart
      if (ctx.hasUI) {
        await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
          const maxLabel = Math.max(...rows.map((r) => r.label.length), extraLine !== null ? "Extra usage".length : 0);
          const barWidth = 25;
          const lines: string[] = [];

          // Header
          const title = theme.bold("Anthropic Usage");
          lines.push(title);
          lines.push(theme.fg("dim", "─".repeat(maxLabel + barWidth + 16)));
          lines.push("");

          // Bar rows
          for (const r of rows) {
            const pct = Math.round(r.utilization);
            const filled = Math.round((r.utilization / 100) * barWidth);
            const empty = barWidth - filled;
            const color = barColor(r.utilization);

            const label = theme.bold(r.label.padEnd(maxLabel));
            const bar = theme.fg(color, "█".repeat(filled)) + theme.fg("dim", "░".repeat(empty));
            const pctStr = theme.bold(`${String(pct).padStart(3)}%`);
            const resetStr = theme.fg("muted", r.resetStr);

            lines.push(`${label}  ${bar}  ${pctStr}  ${resetStr}`);
          }

          // Extra usage row
          if (extraLine !== null) {
            const label = theme.bold("Extra usage".padEnd(maxLabel));
            lines.push(`${label}  ${theme.fg("muted", extraLine)}`);
          }

          lines.push("");
          lines.push(theme.fg("dim", "press esc to close"));

          const text = new Text(lines.join("\n"), 1, 1);
          text.handleInput = (data: string) => {
            if (matchesKey(data, "escape") || matchesKey(data, "return")) {
              done();
            }
          };
          return text;
        });
      } else {
        // Non-interactive fallback
        ctx.ui.notify(formatPlain(rows, extraLine), "info");
      }
    },
  });
}
