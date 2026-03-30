import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { existsSync } from "node:fs";

export function createWorkdirCommand(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/workdir(?:@\w+)?\s*/, "").trim();

    if (!args) {
      const chatId = ctx.chat!.id;
      const session = sessionStore.get(chatId);
      const current = session?.workingDir ?? config.defaultWorkingDir;
      await ctx.reply(`Current working directory: <code>${current}</code>\n\nUsage: /workdir /path/to/dir`, { parse_mode: "HTML" });
      return;
    }

    if (!existsSync(args)) {
      await ctx.reply(`Directory not found: ${args}`);
      return;
    }

    const chatId = ctx.chat!.id;
    const session = sessionStore.get(chatId);
    sessionStore.set(chatId, {
      claudeSessionId: session?.claudeSessionId ?? null,
      model: session?.model ?? config.claudeModel,
      workingDir: args,
      lastActivity: Date.now(),
    });

    await ctx.reply(`Working directory set to <code>${args}</code>`, { parse_mode: "HTML" });
  };
}
