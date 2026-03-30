import "dotenv/config";

export interface Config {
  telegramToken: string;
  allowedUserIds: Set<number>;
  claudeModel: string;
  defaultWorkingDir: string;
  allowedWorkdirBase: string | undefined;
  maxBudgetUsd: number | undefined;
  sessionTtlMs: number;
  claudeBinary: string;
  allowedTools: string[] | undefined;
  webhook: { url: string; port: number; secret: string } | null;
}

export function loadConfig(): Config {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  const allowedUserIdsRaw = process.env.ALLOWED_USER_IDS;
  if (!allowedUserIdsRaw) {
    throw new Error("ALLOWED_USER_IDS environment variable is required");
  }

  const allowedUserIds = new Set(
    allowedUserIdsRaw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => {
        const num = Number(id);
        if (!Number.isInteger(num)) {
          throw new Error(`Invalid user ID: ${id}`);
        }
        return num;
      }),
  );

  if (allowedUserIds.size === 0) {
    throw new Error("ALLOWED_USER_IDS must contain at least one valid user ID");
  }

  const claudeModel = process.env.CLAUDE_MODEL || "sonnet";
  const defaultWorkingDir = process.env.DEFAULT_WORKING_DIR || process.cwd();
  const allowedWorkdirBase = process.env.ALLOWED_WORKDIR_BASE || undefined;
  const claudeBinary = process.env.CLAUDE_BINARY || "claude";

  const maxBudgetRaw = process.env.MAX_BUDGET_USD;
  const maxBudgetUsd = maxBudgetRaw ? Number(maxBudgetRaw) : undefined;
  if (maxBudgetUsd !== undefined && (isNaN(maxBudgetUsd) || maxBudgetUsd <= 0)) {
    throw new Error(`Invalid MAX_BUDGET_USD: ${maxBudgetRaw}`);
  }

  const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || "24");
  if (isNaN(sessionTtlHours) || sessionTtlHours <= 0) {
    throw new Error(`Invalid SESSION_TTL_HOURS: ${process.env.SESSION_TTL_HOURS}`);
  }
  const sessionTtlMs = sessionTtlHours * 60 * 60 * 1000;

  const allowedToolsRaw = process.env.ALLOWED_TOOLS;
  const allowedTools = allowedToolsRaw
    ? allowedToolsRaw.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  // Webhook config: only enabled if WEBHOOK_URL is set
  let webhook: Config["webhook"] = null;
  const webhookUrl = process.env.WEBHOOK_URL;
  if (webhookUrl) {
    const port = Number(process.env.WEBHOOK_PORT ?? "8443");
    if (isNaN(port) || port <= 0) {
      throw new Error(`Invalid WEBHOOK_PORT: ${process.env.WEBHOOK_PORT}`);
    }
    const secret = process.env.WEBHOOK_SECRET ?? crypto.randomUUID();
    webhook = { url: webhookUrl, port, secret };
  }

  return {
    telegramToken,
    allowedUserIds,
    claudeModel,
    defaultWorkingDir,
    allowedWorkdirBase,
    maxBudgetUsd,
    sessionTtlMs,
    claudeBinary,
    allowedTools,
    webhook,
  };
}
