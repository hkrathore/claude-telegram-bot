import type { BotContext } from "../types.js";
import { BOT_COMMANDS, SKILL_COMMANDS } from "./index.js";

export async function helpCommand(ctx: BotContext): Promise<void> {
  let text = "<b>Bot Commands</b>\n";
  for (const cmd of BOT_COMMANDS) {
    text += `/${cmd.command} - ${cmd.description}\n`;
  }
  text += "\n<b>Claude Code Skills</b>\n";
  for (const cmd of SKILL_COMMANDS) {
    text += `/${cmd.command} - ${cmd.description}\n`;
  }
  text += "\nOr just send any message to chat with Claude.";
  await ctx.reply(text, { parse_mode: "HTML" });
}
