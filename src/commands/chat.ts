import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeClaude } from "../claude/cli.js";
import { sendClaudeResponse } from "../util/reply.js";
import { withTyping } from "../middleware/typing.js";

export function createChatHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text;
    if (!text) return;

    const chatId = ctx.chat!.id;
    const session = sessionStore.get(chatId);

    await withTyping(ctx, async () => {
      const result = await invokeClaude({
        prompt: text,
        sessionId: session?.claudeSessionId ?? undefined,
        model: session?.model ?? config.claudeModel,
        workingDir: session?.workingDir ?? config.defaultWorkingDir,
        allowedTools: config.allowedTools,
        maxBudgetUsd: config.maxBudgetUsd,
      }, (event) => {
        // Could send progress updates here for tool_use events
      });

      // Update session
      sessionStore.set(chatId, {
        claudeSessionId: result.sessionId,
        model: session?.model ?? config.claudeModel,
        workingDir: session?.workingDir ?? config.defaultWorkingDir,
        lastActivity: Date.now(),
      });

      // Format and send response
      await sendClaudeResponse(ctx, result.fullText);
    });
  };
}
