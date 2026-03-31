import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";

const VALID_EFFORTS = ["low", "medium", "high", "max", "auto"];

export function createEffortCommand(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/effort(?:@\w+)?\s*/, "").trim();

    if (!args) {
      const chatId = ctx.chat!.id;
      const session = sessionStore.get(chatId);
      const current = session?.effort ?? "auto";
      await ctx.reply(
        `Current effort: <b>${current}</b>\n\nUsage: /effort [${VALID_EFFORTS.join(" | ")}]`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const effort = args.toLowerCase();
    if (!VALID_EFFORTS.includes(effort)) {
      await ctx.reply(`Invalid effort level. Choose from: ${VALID_EFFORTS.join(", ")}`);
      return;
    }

    const chatId = ctx.chat!.id;
    const session = sessionStore.get(chatId);
    sessionStore.set(chatId, {
      claudeSessionId: session?.claudeSessionId ?? null,
      model: session?.model ?? config.claudeModel,
      workingDir: session?.workingDir ?? config.defaultWorkingDir,
      lastActivity: Date.now(),
      effort,
    });

    await ctx.reply(`Effort level set to <b>${effort}</b>`, { parse_mode: "HTML" });
  };
}
