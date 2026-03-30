import type { BotContext } from "../types.js";
import type { SessionStore } from "../claude/session-store.js";

export function createSessionCommand(sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/session(?:@\w+)?\s*/, "").trim().toLowerCase();
    const chatId = ctx.chat!.id;

    if (args === "new") {
      sessionStore.delete(chatId);
      await ctx.reply("Session cleared. Next message starts a fresh conversation.");
      return;
    }

    const session = sessionStore.get(chatId);
    if (!session?.claudeSessionId) {
      await ctx.reply("No active session. Send a message to start one.\n\nUsage: /session new - clear current session");
      return;
    }

    await ctx.reply(
      `<b>Active Session</b>\n` +
      `Session ID: <code>${session.claudeSessionId}</code>\n` +
      `Model: ${session.model}\n` +
      `Working dir: <code>${session.workingDir}</code>\n\n` +
      `/session new - start fresh`,
      { parse_mode: "HTML" }
    );
  };
}
