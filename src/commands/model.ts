import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";

const VALID_MODELS = ["sonnet", "opus", "haiku"];

export function createModelCommand(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/model(?:@\w+)?\s*/, "").trim();

    if (!args) {
      const chatId = ctx.chat!.id;
      const session = sessionStore.get(chatId);
      const current = session?.model ?? config.claudeModel;
      await ctx.reply(
        `Current model: <b>${current}</b>\n\nUsage: /model [${VALID_MODELS.join(" | ")}]`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const model = args.toLowerCase();
    if (!VALID_MODELS.includes(model)) {
      await ctx.reply(`Invalid model. Choose from: ${VALID_MODELS.join(", ")}`);
      return;
    }

    const chatId = ctx.chat!.id;
    const session = sessionStore.get(chatId);
    sessionStore.set(chatId, {
      claudeSessionId: session?.claudeSessionId ?? null,
      model,
      workingDir: session?.workingDir ?? config.defaultWorkingDir,
      lastActivity: Date.now(),
    });

    await ctx.reply(`Model switched to <b>${model}</b>`, { parse_mode: "HTML" });
  };
}
