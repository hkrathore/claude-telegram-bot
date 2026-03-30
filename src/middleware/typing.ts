import type { BotContext } from "../types.js";

/**
 * Wrap a long-running operation with an auto-refreshing "typing" indicator.
 * Sends `typing` chat action immediately, then every 4 seconds until the
 * operation resolves or rejects.
 */
export async function withTyping(
  ctx: BotContext,
  operation: () => Promise<void>,
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await operation();
    return;
  }

  const sendTyping = () => {
    ctx.api.sendChatAction(chatId, "typing").catch(() => {
      // Silently ignore – chat may have been deleted or bot blocked
    });
  };

  // Fire immediately, then every 4s
  sendTyping();
  const interval = setInterval(sendTyping, 4000);

  try {
    await operation();
  } finally {
    clearInterval(interval);
  }
}
