import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "./session-store.js";
import { invokeClaude } from "./cli.js";
import { sendClaudeResponse } from "../util/reply.js";
import { withTyping } from "../middleware/typing.js";
import { startInvocation, clearInvocation, isActive } from "../state.js";

interface InvokeOptions {
  ctx: BotContext;
  config: Config;
  sessionStore: SessionStore;
  prompt: string;
}

/**
 * Shared invoke-and-respond flow used by chat, skills, media, and retry.
 * Handles: rate limiting, typing indicator, progress messages,
 * session persistence, response formatting, and cleanup.
 *
 * Returns false if the chat was already busy (rate limited).
 */
export async function invokeAndRespond(opts: InvokeOptions): Promise<boolean> {
  const { ctx, config, sessionStore, prompt } = opts;
  const chatId = ctx.chat!.id;

  if (isActive(chatId)) {
    await ctx.reply("Already processing a request. Use /cancel to abort it.");
    return false;
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
          } catch { /* ignore edit failures */ }
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

    return true;
  } finally {
    clearInvocation(chatId);
  }
}
