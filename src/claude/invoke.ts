import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "./session-store.js";
import { invokeClaude } from "./cli.js";
import { sendClaudeResponse } from "../util/reply.js";
import { sendOutputFiles } from "../util/files.js";
import { withTyping } from "../middleware/typing.js";
import { startInvocation, clearInvocation, isActive, enqueueMessage, dequeueMessage, queueSize } from "../state.js";

interface InvokeOptions {
  ctx: BotContext;
  config: Config;
  sessionStore: SessionStore;
  prompt: string;
  bare?: boolean;
}

/**
 * Shared invoke-and-respond flow used by chat, skills, media, and retry.
 * Handles: queuing, typing indicator, progress messages,
 * session persistence, response formatting, cost reporting, and cleanup.
 *
 * If the chat is busy, queues the message (up to 5) instead of rejecting.
 */
export async function invokeAndRespond(opts: InvokeOptions): Promise<void> {
  const { ctx, config, sessionStore, prompt } = opts;
  const chatId = ctx.chat!.id;

  const bare = opts.bare;

  if (isActive(chatId)) {
    const queued = enqueueMessage(chatId, prompt);
    if (queued === null) {
      await ctx.reply("Queue full (max 5). Wait for current requests to finish.");
      return;
    }
    const pos = queueSize(chatId);
    await ctx.reply(`Queued (position ${pos}). Will process after current request.`);
    await queued; // wait until dequeued
    // When we get here, the previous invocation has finished and dequeued us.
    // We need to run ourselves now via processPrompt.
  }

  await processPrompt(ctx, config, sessionStore, chatId, prompt, bare);
}

async function processPrompt(
  ctx: BotContext,
  config: Config,
  sessionStore: SessionStore,
  chatId: number,
  prompt: string,
  bare?: boolean,
): Promise<void> {
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
        bare,
        effort: session?.effort,
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
        effort: session?.effort,
      });

      if (progressMsgId) {
        await ctx.api.deleteMessage(chatId, progressMsgId).catch(() => {});
      }

      // Append cost inline if enabled
      let responseText = result.fullText;
      if (config.showCost && result.costUsd !== undefined && result.costUsd > 0) {
        const cost = result.costUsd < 0.01
          ? `$${result.costUsd.toFixed(4)}`
          : `$${result.costUsd.toFixed(2)}`;
        responseText += `\n\n_Cost: ${cost}_`;
      }

      await sendClaudeResponse(ctx, responseText);

      // Send any output files Claude created/mentioned
      await sendOutputFiles(ctx, result.fullText);
    });
  } finally {
    clearInvocation(chatId);

    // Process next queued message if any
    const nextPrompt = dequeueMessage(chatId);
    if (nextPrompt) {
      // Run asynchronously so we don't block the current handler's cleanup
      processPrompt(ctx, config, sessionStore, chatId, nextPrompt).catch((err) => {
        console.error("Error processing queued message:", err);
      });
    }
  }
}
