import type { BotContext } from "../types.js";
import { markdownToTelegramHtml } from "./format.js";
import { chunkMessage } from "./chunker.js";

/**
 * Send a Claude response back to Telegram.
 * Tries HTML formatting first; falls back to plain text if Telegram rejects the HTML.
 */
export async function sendClaudeResponse(ctx: BotContext, text: string): Promise<void> {
  const html = markdownToTelegramHtml(text);
  const chunks = chunkMessage(html);

  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, { parse_mode: "HTML" });
    } catch (err) {
      // If Telegram rejects our HTML, fall back to plain text
      const isParseError =
        err instanceof Error &&
        err.message.includes("can't parse entities");
      if (isParseError) {
        // Send the original markdown chunk without HTML formatting
        const plainChunks = chunkMessage(text);
        for (const plain of plainChunks) {
          await ctx.reply(plain);
        }
        return; // bail out of the HTML loop
      }
      throw err;
    }
  }
}
