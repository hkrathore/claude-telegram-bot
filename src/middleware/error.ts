import type { BotContext } from "../types.js";
import { type NextFunction } from "grammy";

/**
 * Error-boundary middleware. Catches any error thrown by downstream
 * middleware / handlers and replies with a user-friendly message.
 */
export function errorMiddleware() {
  return async (ctx: BotContext, next: NextFunction) => {
    try {
      await next();
    } catch (err) {
      console.error("Bot error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      await ctx.reply(`Error: ${message}`).catch(() => {
        // If we can't even send the error, nothing more we can do
      });
    }
  };
}
