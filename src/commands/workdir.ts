import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";

export function createWorkdirCommand(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/workdir(?:@\w+)?\s*/, "").trim();

    if (!args) {
      const chatId = ctx.chat!.id;
      const session = sessionStore.get(chatId);
      const current = session?.workingDir ?? config.defaultWorkingDir;
      let info = `Current working directory: <code>${current}</code>\n\nUsage: /workdir /path/to/dir`;
      if (config.allowedWorkdirBase) {
        info += `\nRestricted to: <code>${config.allowedWorkdirBase}</code>`;
      }
      await ctx.reply(info, { parse_mode: "HTML" });
      return;
    }

    const resolved = resolve(args);

    if (!existsSync(resolved)) {
      await ctx.reply(`Directory not found: ${args}`);
      return;
    }

    // Security: enforce allowed base directory
    if (config.allowedWorkdirBase) {
      const base = resolve(config.allowedWorkdirBase);
      if (!resolved.startsWith(base + "/") && resolved !== base) {
        await ctx.reply(`Denied. Working directory must be under <code>${base}</code>`, { parse_mode: "HTML" });
        return;
      }
    }

    const chatId = ctx.chat!.id;
    const session = sessionStore.get(chatId);
    sessionStore.set(chatId, {
      claudeSessionId: session?.claudeSessionId ?? null,
      model: session?.model ?? config.claudeModel,
      workingDir: resolved,
      lastActivity: Date.now(),
      effort: session?.effort,
    });

    await ctx.reply(`Working directory set to <code>${resolved}</code>`, { parse_mode: "HTML" });
  };
}
