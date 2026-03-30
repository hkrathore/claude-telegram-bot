import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import crypto from "node:crypto";
import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";

const TEMP_DIR = "/tmp/claude-telegram-bot";

export function createMediaHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    // Determine file ID and metadata
    let fileId: string | undefined;
    let fileName: string;
    let defaultPrompt: string;

    if (ctx.message?.photo) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      fileId = photo.file_id;
      fileName = `photo_${crypto.randomUUID()}.jpg`;
      defaultPrompt = "Describe what you see in this image.";
    } else if (ctx.message?.document) {
      fileId = ctx.message.document.file_id;
      const origName = ctx.message.document.file_name ?? "file";
      const ext = extname(origName) || "";
      fileName = `doc_${crypto.randomUUID()}${ext}`;
      defaultPrompt = `Analyze this file (${origName}).`;
    } else {
      return;
    }

    if (!fileId) return;

    const caption = ctx.message?.caption?.trim();
    const prompt = caption || defaultPrompt;

    // Download file from Telegram before starting invocation
    mkdirSync(TEMP_DIR, { recursive: true });
    const localPath = join(TEMP_DIR, fileName);

    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) {
      await ctx.reply("Could not download file from Telegram.");
      return;
    }

    const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(localPath, buffer);

    try {
      const claudePrompt = `I've saved a file to ${localPath}. Please read it and then: ${prompt}`;
      await invokeAndRespond({ ctx, config, sessionStore, prompt: claudePrompt });
    } finally {
      try { unlinkSync(localPath); } catch { /* ignore */ }
    }
  };
}
