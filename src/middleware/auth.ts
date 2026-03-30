import { type NextFunction } from "grammy";
import type { BotContext } from "../types.js";

/**
 * User-allowlist middleware. Must be first in the middleware chain.
 * Only users whose Telegram numeric ID is in `allowedUserIds` may interact.
 */
export function authMiddleware(allowedUserIds: Set<number>) {
  return async (ctx: BotContext, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId || !allowedUserIds.has(userId)) {
      await ctx.reply("Unauthorized. Your user ID is not in the allowlist.");
      return; // don't call next()
    }
    await next();
  };
}
