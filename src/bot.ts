import { Bot } from "grammy";
import type { Config } from "./config.js";
import type { BotContext } from "./types.js";
import { SessionStore } from "./claude/session-store.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorMiddleware } from "./middleware/error.js";
import { getFailedPrompt, clearFailedPrompt } from "./middleware/retry.js";
import { startCommand } from "./commands/start.js";
import { helpCommand } from "./commands/help.js";
import { createChatHandler } from "./commands/chat.js";
import { createSkillHandler } from "./commands/skills.js";
import { createMediaHandler } from "./commands/media.js";
import { createModelCommand } from "./commands/model.js";
import { createWorkdirCommand } from "./commands/workdir.js";
import { createSessionCommand } from "./commands/session.js";
import { SKILL_COMMANDS } from "./commands/index.js";
import { cancelInvocation } from "./state.js";
import { invokeClaude } from "./claude/cli.js";
import { sendClaudeResponse } from "./util/reply.js";
import { withTyping } from "./middleware/typing.js";
import { startInvocation, clearInvocation, isActive } from "./state.js";

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

  // Cancel: abort running Claude process
  bot.command("cancel", async (ctx) => {
    const chatId = ctx.chat!.id;
    const cancelled = cancelInvocation(chatId);
    if (cancelled) {
      await ctx.reply("Cancelled.");
    } else {
      await ctx.reply("No operation currently running.");
    }
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

    if (isActive(chatId)) {
      await ctx.reply("Already processing a request. Use /cancel to abort it.");
      return;
    }

    const session = sessionStore.get(chatId);
    const controller = startInvocation(chatId);

    let progressMsgId: number | undefined;
    let lastProgressTool = "";

    try {
      await withTyping(ctx, async () => {
        const result = await invokeClaude(config, {
          prompt,
          sessionId: session?.claudeSessionId ?? undefined,
          model: session?.model ?? config.claudeModel,
          workingDir: session?.workingDir ?? config.defaultWorkingDir,
          allowedTools: config.allowedTools,
          maxBudgetUsd: config.maxBudgetUsd,
          abortSignal: controller.signal,
        }, async (event) => {
          if (event.type === "tool_use" && event.tool !== lastProgressTool) {
            lastProgressTool = event.tool;
            const status = `Using ${event.tool}...`;
            try {
              if (!progressMsgId) {
                const msg = await ctx.reply(status);
                progressMsgId = msg.message_id;
              } else {
                await ctx.api.editMessageText(chatId, progressMsgId, status);
              }
            } catch { /* ignore */ }
          }
        });

        sessionStore.set(chatId, {
          claudeSessionId: result.sessionId,
          model: session?.model ?? config.claudeModel,
          workingDir: session?.workingDir ?? config.defaultWorkingDir,
          lastActivity: Date.now(),
        });

        if (progressMsgId) {
          await ctx.api.deleteMessage(chatId, progressMsgId).catch(() => {});
        }

        await sendClaudeResponse(ctx, result.fullText);
      });
    } finally {
      clearInvocation(chatId);
    }
  });

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
