import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";

/**
 * Keywords that suggest the user needs project context, tools, or file access.
 * When detected, we skip --bare so Claude has full capabilities.
 */
const NEEDS_TOOLS_PATTERNS = [
  /\b(file|code|function|class|module|import|export|variable|bug|error|fix|refactor|test|build|deploy|compile|lint)\b/i,
  /\b(commit|push|pull|merge|branch|git|pr|review)\b/i,
  /\b(read|write|edit|create|delete|move|rename|search|grep|find)\b/i,
  /\b(run|execute|install|npm|pip|docker|make|script)\b/i,
  /\b(src|dist|lib|config|package\.json|tsconfig|\.env|\.ts|\.js|\.py|\.go|\.rs)\b/i,
  /[\/\\][\w.-]+\.[a-z]{1,5}\b/,  // file paths like /src/index.ts or ./foo.py
];

function needsFullContext(prompt: string): boolean {
  return NEEDS_TOOLS_PATTERNS.some((pattern) => pattern.test(prompt));
}

export function createChatHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const text = ctx.message?.text;
    if (!text) return;

    // Auto-detect: use bare mode for casual chat, full mode for code/tool work
    const bare = !needsFullContext(text);

    await invokeAndRespond({ ctx, config, sessionStore, prompt: text, bare });
  };
}
