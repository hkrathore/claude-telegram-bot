import { mkdirSync, writeFileSync, unlinkSync, createReadStream } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeAndRespond } from "../claude/invoke.js";

const TEMP_DIR = "/tmp/claude-telegram-bot";

export function createVoiceHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const voice = ctx.message?.voice ?? ctx.message?.audio;
    if (!voice) return;

    if (!config.openaiApiKey) {
      await ctx.reply("Voice messages require OPENAI_API_KEY to be set for transcription.");
      return;
    }

    // Download voice file from Telegram
    const file = await ctx.api.getFile(voice.file_id);
    if (!file.file_path) {
      await ctx.reply("Could not download voice message.");
      return;
    }

    mkdirSync(TEMP_DIR, { recursive: true });
    const ext = file.file_path.endsWith(".oga") ? ".ogg" : ".ogg";
    const localPath = join(TEMP_DIR, `voice_${crypto.randomUUID()}${ext}`);

    try {
      // Download
      const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(localPath, buffer);

      // Transcribe via OpenAI Whisper API
      const formData = new FormData();
      const fileBlob = new Blob([buffer], { type: "audio/ogg" });
      formData.append("file", fileBlob, "voice.ogg");
      formData.append("model", "whisper-1");

      const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: formData,
      });

      if (!whisperResponse.ok) {
        const err = await whisperResponse.text();
        await ctx.reply(`Transcription failed: ${err}`);
        return;
      }

      const result = await whisperResponse.json() as { text: string };
      const transcript = result.text?.trim();

      if (!transcript) {
        await ctx.reply("Could not transcribe voice message.");
        return;
      }

      // Show the transcript to the user
      await ctx.reply(`🎤 ${transcript}`, { parse_mode: undefined });

      // Forward to Claude
      await invokeAndRespond({ ctx, config, sessionStore, prompt: transcript });
    } finally {
      try { unlinkSync(localPath); } catch { /* ignore */ }
    }
  };
}
