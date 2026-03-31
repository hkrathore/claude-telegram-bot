import { Bot } from "grammy";
import type { Config } from "./config.js";
import type { BotContext } from "./types.js";
import { SessionStore } from "./claude/session-store.js";
import { invokeAndRespond } from "./claude/invoke.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/error.js";
import { getFailedPrompt, clearFailedPrompt } from "./middleware/retry.js";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { createChatHandler } from "./commands/chat.js";
import { createSkillHandler } from "./commands/skills.js";
import { createMediaHandler } from "./commands/media.js";
import { createVoiceHandler } from "./commands/voice.js";
import { createModelCommand } from "./commands/model.js";
import { createWorkdirCommand } from "./commands/workdir.js";
import { createSessionCommand } from "./commands/session.js";
import { createEffortCommand } from "./commands/effort.js";
import { createCompactCommand } from "./commands/cli-commands.js";
import { SKILL_COMMANDS } from "./commands/index.js";
import { cancelInvocation } from "./state.js";

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
  bot.command("effort", createEffortCommand(config, sessionStore));
  bot.command("workdir", createWorkdirCommand(config, sessionStore));
  bot.command("session", createSessionCommand(sessionStore));
  bot.command("compact", createCompactCommand(config, sessionStore));

  // Cancel: abort running Claude process
  bot.command("cancel", async (ctx) => {
    const chatId = ctx.chat!.id;
    const cancelled = cancelInvocation(chatId);
    await ctx.reply(cancelled ? "Cancelled." : "No operation currently running.");
  });

  // Register all skill commands
  const skillHandler = createSkillHandler(config, sessionStore);
  for (const cmd of SKILL_COMMANDS) {
    bot.command(cmd.command, skillHandler);
  }

  // Retry callback: re-run the last failed prompt
  bot.callbackQuery("retry", async (ctx) => {
    await ctx.answerCallbackQuery();
    const chatId = ctx.chat!.id;

    const prompt = getFailedPrompt(chatId);
    if (!prompt) {
      await ctx.reply("Nothing to retry.");
      return;
    }

    clearFailedPrompt(chatId);

    // Remove the error message with the retry button
    if (ctx.callbackQuery.message?.message_id) {
      await ctx.api.deleteMessage(chatId, ctx.callbackQuery.message.message_id).catch(() => {});
    }

    await invokeAndRespond({ ctx, config, sessionStore, prompt });
  });

  // Voice message handler
  const voiceHandler = createVoiceHandler(config, sessionStore);
  bot.on("message:voice", voiceHandler);
  bot.on("message:audio", voiceHandler);

  // Photo and document handler
  const mediaHandler = createMediaHandler(config, sessionStore);
  bot.on("message:photo", mediaHandler);
  bot.on("message:document", mediaHandler);

  // Default handler: freeform messages -> Claude
  bot.on("message:text", createChatHandler(config, sessionStore));

  // Periodic session cleanup every hour
  setInterval(() => sessionStore.cleanup(), 60 * 60 * 1000);

  return bot;
}
