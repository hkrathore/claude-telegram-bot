import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeClaude } from "../claude/cli.js";
import { markdownToTelegramHtml } from "../util/format.js";
import { chunkMessage } from "../util/chunker.js";
import { withTyping } from "../middleware/typing.js";
import { toClaudeSkill, SKILL_COMMANDS } from "./index.js";

export function createSkillHandler(config: Config, sessionStore: SessionStore) {
  // Returns a handler that works for any skill command
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
    const session = sessionStore.get(chatId);

    // Forward as "/<skill-name> <args>" to Claude
    const prompt = `/${skillName}${args ? " " + args : ""}`;

    await withTyping(ctx, async () => {
      const result = await invokeClaude({
        prompt,
        sessionId: session?.claudeSessionId ?? undefined,
        model: session?.model ?? config.claudeModel,
        workingDir: session?.workingDir ?? config.defaultWorkingDir,
        allowedTools: config.allowedTools,
        maxBudgetUsd: config.maxBudgetUsd,
      }, () => {});

      sessionStore.set(chatId, {
        claudeSessionId: result.sessionId,
        model: session?.model ?? config.claudeModel,
        workingDir: session?.workingDir ?? config.defaultWorkingDir,
        lastActivity: Date.now(),
      });

      const html = markdownToTelegramHtml(result.fullText);
      const chunks = chunkMessage(html);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "HTML" });
      }
    });
  };
}
