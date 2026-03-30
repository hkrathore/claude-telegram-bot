import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";

export function createChatHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text;
    if (!text) return;
    await invokeAndRespond({ ctx, config, sessionStore, prompt: text });
  };
}
