import type { BotContext } from "../types.js";

export async function startCommand(ctx: BotContext): Promise<void> {
  const name = ctx.from?.first_name ?? "there";
  await ctx.reply(
    `Hi ${name}! I'm your Claude Code bridge bot.\n\n` +
    `Send me any message and I'll forward it to Claude.\n` +
    `Use /help to see all available commands.\n\n` +
    `Set your working directory with /workdir <path>`,
    { parse_mode: "HTML" }
  );
}
