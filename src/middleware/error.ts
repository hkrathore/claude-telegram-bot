import type { BotContext } from "../types.js";
import { type NextFunction } from "grammy";
import { retryKeyboard, storeFailedPrompt } from "./retry.js";

/**
 * Error-boundary middleware. Catches any error thrown by downstream
 * middleware / handlers and replies with a user-friendly message.
 * If the original message had text, stores it for retry and shows a Retry button.
 */
export function errorMiddleware() {
  return async (ctx: BotContext, next: NextFunction) => {
    try {
      await next();
    } catch (err) {
      console.error("Bot error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      const chatId = ctx.chat?.id;
      const prompt = ctx.message?.text;

      if (chatId && prompt) {
        storeFailedPrompt(chatId, prompt);
        await ctx.reply(`Error: ${message}`, { reply_markup: retryKeyboard() }).catch(() => {});
      } else {
        await ctx.reply(`Error: ${message}`).catch(() => {});
      }
    }
  };
}
