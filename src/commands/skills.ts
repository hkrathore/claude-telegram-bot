import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeClaude } from "../claude/cli.js";
import { sendClaudeResponse } from "../util/reply.js";
import { withTyping } from "../middleware/typing.js";
import { startInvocation, clearInvocation, isActive } from "../state.js";
import { toClaudeSkill, SKILL_COMMANDS } from "./index.js";

export function createSkillHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text ?? "";
    // Extract command name: "/commit_push_pr some args" -> "commit_push_pr"
    const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)/s);
    if (!match) return;

    const [, command, args] = match;
    const skillName = toClaudeSkill(command);

    // Verify it's a registered skill
    if (!SKILL_COMMANDS.some(c => c.command === command)) return;

    const chatId = ctx.chat!.id;

    // Rate limit: one active invocation per chat
    if (isActive(chatId)) {
      await ctx.reply("Already processing a request. Use /cancel to abort it.");
      return;
    }

    const session = sessionStore.get(chatId);
    const controller = startInvocation(chatId);

    // Forward as "/<skill-name> <args>" to Claude
    const prompt = `/${skillName}${args ? " " + args : ""}`;

    // Progress tracking
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

        // Clean up progress message
        if (progressMsgId) {
          await ctx.api.deleteMessage(chatId, progressMsgId).catch(() => {});
        }

        await sendClaudeResponse(ctx, result.fullText);
      });
    } finally {
      clearInvocation(chatId);
    }
  };
}
