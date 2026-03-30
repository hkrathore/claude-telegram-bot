import { Bot } from "grammy";
import type { Config } from "./config.js";
import type { BotContext } from "./types.js";
import { SessionStore } from "./claude/session-store.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/error.js";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { createChatHandler } from "./commands/chat.js";
import { createSkillHandler } from "./commands/skills.js";
import { createModelCommand } from "./commands/model.js";
import { createWorkdirCommand } from "./commands/workdir.js";
import { createSessionCommand } from "./commands/session.js";
import { SKILL_COMMANDS } from "./commands/index.js";

export function createBot(config: Config): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.telegramToken);
  const sessionStore = new SessionStore(config.sessionTtlMs);

  // Middleware chain: error boundary -> auth check
  bot.use(errorMiddleware());
  bot.use(authMiddleware(config.allowedUserIds));

  // Bot-native commands
  bot.command("start", startCommand);
  bot.command("help", helpCommand);
  bot.command("model", createModelCommand(config, sessionStore));
  bot.command("workdir", createWorkdirCommand(config, sessionStore));
  bot.command("session", createSessionCommand(sessionStore));

  // Cancel: abort running Claude process (placeholder - needs active process tracking)
  bot.command("cancel", async (ctx) => {
    await ctx.reply("No operation currently running.");
  });

  // Register all skill commands
  const skillHandler = createSkillHandler(config, sessionStore);
  for (const cmd of SKILL_COMMANDS) {
    bot.command(cmd.command, skillHandler);
  }

  // Default handler: freeform messages -> Claude
  bot.on("message:text", createChatHandler(config, sessionStore));

  // Periodic session cleanup every hour
  setInterval(() => sessionStore.cleanup(), 60 * 60 * 1000);

  return bot;
}
