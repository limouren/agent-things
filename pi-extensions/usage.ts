import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text, matchesKey } from "@mariozechner/pi-tui";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ANTHROPIC_USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";
const ANTHROPIC_BETA_HEADER = "oauth-2025-04-20";
const OPENAI_USAGE_ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

// ── Types ──────────────────────────────────────────────────────

interface AnthropicUsageBucket {
  utilization: number | null;
  resets_at: string;
}

interface AnthropicExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

interface AnthropicUsageResponse {
  five_hour?: AnthropicUsageBucket | null;
  seven_day?: AnthropicUsageBucket | null;
  seven_day_sonnet?: AnthropicUsageBucket | null;
  seven_day_opus?: AnthropicUsageBucket | null;
  seven_day_oauth_apps?: AnthropicUsageBucket | null;
  seven_day_cowork?: AnthropicUsageBucket | null;
  extra_usage?: AnthropicExtraUsage | null;
  [key: string]: unknown;
}

interface OpenAIUsageWindow {
  used_percent: number;
  limit_window_seconds: number;
  reset_after_seconds: number;
  reset_at: number;
}

interface OpenAIRateLimitDetails {
  allowed: boolean;
  limit_reached: boolean;
  primary_window?: OpenAIUsageWindow | null;
  secondary_window?: OpenAIUsageWindow | null;
}

interface OpenAICredits {
  has_credits: boolean;
  unlimited: boolean;
  balance?: string | null;
}

interface OpenAIUsageResponse {
  plan_type?: string | null;
  rate_limit?: OpenAIRateLimitDetails | null;
  code_review_rate_limit?: OpenAIRateLimitDetails | null;
  credits?: OpenAICredits | null;
  additional_rate_limits?: Array<{
    limit_name?: string | null;
    metered_feature?: string | null;
    rate_limit?: OpenAIRateLimitDetails | null;
  }> | null;
  [key: string]: unknown;
}

interface DisplayRow {
  label: string;
  utilization: number;
  resetStr: string;
}

interface UsageSection {
  title: string;
  rows: DisplayRow[];
  infoLines: Array<{ label: string; value: string }>;
}

type UsageProvider = "anthropic" | "openai";

interface AuthFile {
  anthropic?: {
    access?: string;
    expires?: number;
  };
  "openai-codex"?: {
    access?: string;
    expires?: number;
    accountId?: string;
  };
}

interface ProviderAuth {
  token: string | null;
  expired: boolean;
  error: string | null;
  accountId?: string | null;
}

interface ProviderFetchResult {
  section: UsageSection | null;
  unavailableMessage: string | null;
  warning: string | null;
}

// ── Constants ──────────────────────────────────────────────────

const ANTHROPIC_BUCKET_LABELS: Record<string, string> = {
  five_hour: "Current session",
  seven_day: "Current week (all models)",
  seven_day_sonnet: "Current week (Sonnet)",
  seven_day_opus: "Current week (Opus)",
  seven_day_oauth_apps: "Current week (OAuth apps)",
  seven_day_cowork: "Current week (Cowork)",
};

// ── Formatting helpers ─────────────────────────────────────────

function formatResetDate(reset: Date): string {
  const now = new Date();
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

function formatResetTime(resetsAt: string): string {
  return formatResetDate(new Date(resetsAt));
}

function formatUnixResetTime(resetAtSeconds: number): string {
  return formatResetDate(new Date(resetAtSeconds * 1000));
}

function barColor(utilization: number): "success" | "warning" | "error" {
  if (utilization > 80) return "error";
  if (utilization > 50) return "warning";
  return "success";
}

function titleCasePlan(plan: string | null | undefined): string | null {
  if (!plan) return null;
  return plan
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDurationLabel(seconds: number, fallback: string): string {
  const known: Record<number, string> = {
    3600: "Hourly limit",
    18000: "5h limit",
    86400: "Daily limit",
    604800: "Weekly limit",
  };
  if (known[seconds]) return known[seconds];
  if (seconds % 604800 === 0) return `${seconds / 604800}w limit`;
  if (seconds % 86400 === 0) return `${seconds / 86400}d limit`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h limit`;
  return fallback;
}

function formatCredits(balance: string | null | undefined): string | null {
  if (balance === null || balance === undefined) return null;
  const n = Number(balance);
  if (!Number.isFinite(n)) return balance;
  if (n === 0) return null;
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

function normalizeUsageProvider(provider: string | null | undefined): UsageProvider | null {
  if (!provider) return null;
  const normalized = provider.toLowerCase();
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "openai-codex") return "openai";
  return null;
}

// ── Auth ───────────────────────────────────────────────────────

function getAuthDir(): string {
  return process.env.PI_CODING_AGENT_DIR || join(process.env.HOME || "~", ".pi", "agent");
}

function readAuthFile(): { auth: AuthFile | null; error: string | null } {
  const authPath = join(getAuthDir(), "auth.json");
  try {
    const raw = readFileSync(authPath, "utf-8");
    return { auth: JSON.parse(raw), error: null };
  } catch (e: any) {
    if (e.code === "ENOENT") {
      return { auth: null, error: "Not logged in. Use /login to sign in." };
    }
    return { auth: null, error: `Failed to read auth: ${e.message}` };
  }
}

function readAnthropicAuth(auth: AuthFile | null, authError: string | null): ProviderAuth {
  if (!auth) return { token: null, expired: false, error: authError };
  const anthropic = auth.anthropic;
  if (!anthropic?.access) {
    return { token: null, expired: false, error: "No Anthropic credentials found." };
  }
  return {
    token: anthropic.access,
    expired: typeof anthropic.expires === "number" && anthropic.expires < Date.now(),
    error: null,
  };
}

function readOpenAIAuth(auth: AuthFile | null, authError: string | null): ProviderAuth {
  if (!auth) return { token: null, expired: false, error: authError };
  const openai = auth["openai-codex"];
  if (!openai?.access) {
    return { token: null, expired: false, error: "No OpenAI Codex credentials found." };
  }
  return {
    token: openai.access,
    expired: typeof openai.expires === "number" && openai.expires < Date.now(),
    accountId: openai.accountId ?? null,
    error: null,
  };
}

// ── Data processing ────────────────────────────────────────────

function processAnthropicUsageData(data: AnthropicUsageResponse): UsageSection | null {
  const rows: DisplayRow[] = [];

  for (const [key, label] of Object.entries(ANTHROPIC_BUCKET_LABELS)) {
    const bucket = data[key] as AnthropicUsageBucket | null | undefined;
    if (!bucket || bucket.utilization === null || bucket.utilization === undefined) continue;
    rows.push({
      label,
      utilization: bucket.utilization,
      resetStr: formatResetTime(bucket.resets_at),
    });
  }

  const infoLines: Array<{ label: string; value: string }> = [];
  const extra = data.extra_usage;
  if (extra) {
    if (extra.is_enabled && extra.monthly_limit !== null && extra.used_credits !== null) {
      const used = (extra.used_credits / 100).toFixed(2);
      const limit = (extra.monthly_limit / 100).toFixed(2);
      const pct = extra.utilization !== null ? ` (${Math.round(extra.utilization)}%)` : "";
      infoLines.push({ label: "Extra usage", value: `$${used} / $${limit} spent${pct}` });
    } else {
      infoLines.push({ label: "Extra usage", value: "disabled" });
    }
  }

  if (rows.length === 0 && infoLines.length === 0) return null;
  return { title: "Anthropic Usage", rows, infoLines };
}

function pushOpenAIWindow(rows: DisplayRow[], label: string, window: OpenAIUsageWindow | null | undefined) {
  if (!window) return;
  rows.push({
    label,
    utilization: window.used_percent,
    resetStr: formatUnixResetTime(window.reset_at),
  });
}

function processOpenAIUsageData(data: OpenAIUsageResponse): UsageSection | null {
  const rows: DisplayRow[] = [];
  const infoLines: Array<{ label: string; value: string }> = [];

  if (data.plan_type) {
    infoLines.push({ label: "Plan", value: titleCasePlan(data.plan_type) || data.plan_type });
  }

  pushOpenAIWindow(rows, "5h limit", data.rate_limit?.primary_window);
  pushOpenAIWindow(rows, "Weekly limit", data.rate_limit?.secondary_window);
  pushOpenAIWindow(rows, "Code review", data.code_review_rate_limit?.primary_window);

  for (const limit of data.additional_rate_limits ?? []) {
    if (!limit?.rate_limit) continue;
    const baseLabel = limit.limit_name || limit.metered_feature || "Additional limit";
    const primaryLabel = `${baseLabel} (${formatDurationLabel(limit.rate_limit.primary_window?.limit_window_seconds ?? 0, "primary")})`;
    const secondaryLabel = `${baseLabel} (${formatDurationLabel(limit.rate_limit.secondary_window?.limit_window_seconds ?? 0, "secondary")})`;
    pushOpenAIWindow(rows, primaryLabel, limit.rate_limit.primary_window);
    pushOpenAIWindow(rows, secondaryLabel, limit.rate_limit.secondary_window);
  }

  const credits = data.credits;
  if (credits?.has_credits) {
    if (credits.unlimited) {
      infoLines.push({ label: "Credits", value: "unlimited" });
    } else {
      const balance = formatCredits(credits.balance);
      if (balance) {
        infoLines.push({ label: "Credits", value: `${balance} credits` });
      }
    }
  }

  if (rows.length === 0 && infoLines.length === 0) return null;
  return { title: "OpenAI Usage", rows, infoLines };
}

// ── Fetchers ───────────────────────────────────────────────────

async function fetchAnthropicSection(auth: ProviderAuth): Promise<ProviderFetchResult> {
  if (auth.error || !auth.token) {
    return { section: null, unavailableMessage: auth.error || "No Anthropic access token available.", warning: null };
  }

  let data: AnthropicUsageResponse;
  try {
    const res = await fetch(ANTHROPIC_USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "anthropic-beta": ANTHROPIC_BETA_HEADER,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (res.status === 401) {
      return { section: null, unavailableMessage: "Anthropic session expired. Run /login to re-authenticate.", warning: null };
    }

    if (!res.ok) {
      const body = await res.text();
      return { section: null, unavailableMessage: `Anthropic API error (${res.status}): ${body}`, warning: null };
    }

    data = await res.json();
  } catch (e: any) {
    return { section: null, unavailableMessage: `Anthropic network error: ${e.message}`, warning: null };
  }

  const section = processAnthropicUsageData(data);
  return {
    section,
    unavailableMessage: section ? null : "Anthropic usage is only available for subscription plans (Pro/Max).",
    warning: auth.expired ? "Anthropic OAuth token may be expired. Fetched successfully anyway." : null,
  };
}

async function fetchOpenAISection(auth: ProviderAuth): Promise<ProviderFetchResult> {
  if (auth.error || !auth.token) {
    return { section: null, unavailableMessage: auth.error || "No OpenAI access token available.", warning: null };
  }

  let data: OpenAIUsageResponse;
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
    if (auth.accountId) {
      headers["ChatGPT-Account-Id"] = auth.accountId;
    }

    const res = await fetch(OPENAI_USAGE_ENDPOINT, {
      method: "GET",
      headers,
    });

    if (res.status === 401) {
      return { section: null, unavailableMessage: "OpenAI Codex session expired. Run /login to re-authenticate.", warning: null };
    }

    if (!res.ok) {
      const body = await res.text();
      return { section: null, unavailableMessage: `OpenAI API error (${res.status}): ${body}`, warning: null };
    }

    data = await res.json();
  } catch (e: any) {
    return { section: null, unavailableMessage: `OpenAI network error: ${e.message}`, warning: null };
  }

  const section = processOpenAIUsageData(data);
  return {
    section,
    unavailableMessage: section ? null : "OpenAI Codex usage data is not available for this account.",
    warning: auth.expired ? "OpenAI Codex OAuth token may be expired. Fetched successfully anyway." : null,
  };
}

// ── Rendering ──────────────────────────────────────────────────

function formatPlainSection(section: UsageSection): string {
  const labels = [...section.rows.map((r) => r.label), ...section.infoLines.map((i) => i.label)];
  const maxLabel = Math.max(...labels.map((s) => s.length), 0);
  const barWidth = 25;
  const lines: string[] = [section.title, "─".repeat(60)];

  for (const r of section.rows) {
    const filled = Math.round((r.utilization / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const pct = `${String(Math.round(r.utilization)).padStart(3)}%`;
    lines.push(`${r.label.padEnd(maxLabel)}  ${bar}  ${pct}  ${r.resetStr}`);
  }

  for (const info of section.infoLines) {
    lines.push(`${info.label.padEnd(maxLabel)}  ${info.value}`);
  }

  return lines.join("\n");
}

function formatPlain(sections: UsageSection[]): string {
  return sections.map(formatPlainSection).join("\n\n");
}

function renderInteractiveSection(theme: any, section: UsageSection): string[] {
  const labels = [...section.rows.map((r) => r.label), ...section.infoLines.map((i) => i.label)];
  const maxLabel = Math.max(...labels.map((s) => s.length), 0);
  const barWidth = 25;
  const lines: string[] = [];

  lines.push(theme.bold(section.title));
  lines.push(theme.fg("dim", "─".repeat(maxLabel + barWidth + 16)));
  lines.push("");

  for (const r of section.rows) {
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

  for (const info of section.infoLines) {
    const label = theme.bold(info.label.padEnd(maxLabel));
    lines.push(`${label}  ${theme.fg("muted", info.value)}`);
  }

  return lines;
}

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Show usage limits for the current model provider, or /usage all",
    handler: async (args, ctx) => {
      const arg = (args || "").trim().toLowerCase();
      let requestedProviders: UsageProvider[];

      if (arg === "all") {
        requestedProviders = ["anthropic", "openai"];
      } else if (arg === "anthropic") {
        requestedProviders = ["anthropic"];
      } else if (arg === "openai" || arg === "openai-codex" || arg === "codex") {
        requestedProviders = ["openai"];
      } else if (arg.length > 0) {
        ctx.ui.notify("Usage: /usage [anthropic|openai|all]", "warning");
        return;
      } else {
        const provider = normalizeUsageProvider(ctx.model?.provider);
        if (provider) requestedProviders = [provider];
        else requestedProviders = ["anthropic", "openai"];
      }

      const { auth, error: authError } = readAuthFile();
      const results = await Promise.all(
        requestedProviders.map(async (provider) => {
          if (provider === "anthropic") {
            return [provider, await fetchAnthropicSection(readAnthropicAuth(auth, authError))] as const;
          }
          return [provider, await fetchOpenAISection(readOpenAIAuth(auth, authError))] as const;
        }),
      );

      const resultMap = new Map<UsageProvider, ProviderFetchResult>(results);
      for (const provider of requestedProviders) {
        const result = resultMap.get(provider);
        if (result?.warning) ctx.ui.notify(result.warning, "warning");
      }

      const sections = requestedProviders
        .map((provider) => resultMap.get(provider)?.section ?? null)
        .filter((s): s is UsageSection => s !== null);

      if (sections.length === 0) {
        const details = requestedProviders
          .map((provider) => resultMap.get(provider)?.unavailableMessage)
          .filter(Boolean)
          .join("\n");
        ctx.ui.notify(details || "No usage data available.", "warning");
        return;
      }

      if (ctx.hasUI) {
        await ctx.ui.custom<void>((_tui, theme, _keybindings, done) => {
          const lines: string[] = [];

          for (const [index, section] of sections.entries()) {
            if (index > 0) lines.push("", "");
            lines.push(...renderInteractiveSection(theme, section));
          }

          lines.push("", theme.fg("dim", "press esc to close"));

          const text = new Text(lines.join("\n"), 1, 1);
          text.handleInput = (data: string) => {
            if (matchesKey(data, "escape") || matchesKey(data, "return")) {
              done();
            }
          };
          return text;
        });
      } else {
        ctx.ui.notify(formatPlain(sections), "info");
      }
    },
  });
}
