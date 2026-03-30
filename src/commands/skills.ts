import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";
import { toClaudeSkill, SKILL_COMMANDS } from "./index.js";

export function createSkillHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)/s);
    if (!match) return;

    const [, command, args] = match;

    // Verify it's a registered skill
    if (!SKILL_COMMANDS.some(c => c.command === command)) return;

    const skillName = toClaudeSkill(command);
    const prompt = `/${skillName}${args ? " " + args : ""}`;

    await invokeAndRespond({ ctx, config, sessionStore, prompt });
  };
}
