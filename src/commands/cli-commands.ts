import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";

/**
 * Creates a handler that passes a Claude CLI slash command through.
 * e.g. /compact -> sends "/compact" as the prompt to Claude CLI.
 */
function createCliCommandHandler(cliCommand: string, config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const args = text.replace(/^\/\w+(?:@\w+)?\s*/, "").trim();
    const prompt = `/${cliCommand}${args ? " " + args : ""}`;
    await invokeAndRespond({ ctx, config, sessionStore, prompt });
  };
}

export function createCompactCommand(config: Config, sessionStore: SessionStore) {
  return createCliCommandHandler("compact", config, sessionStore);
}
