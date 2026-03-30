import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import crypto from "node:crypto";
import type { BotContext } from "../types.js";
import type { Config } from "../config.js";
import type { SessionStore } from "../claude/session-store.js";
import { invokeClaude } from "../claude/cli.js";
import { sendClaudeResponse } from "../util/reply.js";
import { withTyping } from "../middleware/typing.js";
import { startInvocation, clearInvocation, isActive } from "../state.js";

const TEMP_DIR = "/tmp/claude-telegram-bot";

export function createMediaHandler(config: Config, sessionStore: SessionStore) {
  return async (ctx: BotContext) => {
    const chatId = ctx.chat!.id;

    if (isActive(chatId)) {
      await ctx.reply("Already processing a request. Use /cancel to abort it.");
      return;
    }

    // Determine file ID and metadata
    let fileId: string | undefined;
    let fileName: string;
    let defaultPrompt: string;

    if (ctx.message?.photo) {
      // Photos come as an array of sizes, pick the largest (last)
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

    const session = sessionStore.get(chatId);
    const controller = startInvocation(chatId);

    // Download file from Telegram
    mkdirSync(TEMP_DIR, { recursive: true });
    const localPath = join(TEMP_DIR, fileName);

    let progressMsgId: number | undefined;
    let lastProgressTool = "";

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        await ctx.reply("Could not download file from Telegram.");
        return;
      }

      const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(localPath, buffer);

      const claudePrompt = `I've saved a file to ${localPath}. Please read it and then: ${prompt}`;

      await withTyping(ctx, async () => {
        const result = await invokeClaude(config, {
          prompt: claudePrompt,
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

        if (progressMsgId) {
          await ctx.api.deleteMessage(chatId, progressMsgId).catch(() => {});
        }

        await sendClaudeResponse(ctx, result.fullText);
      });
    } finally {
      clearInvocation(chatId);
      // Clean up temp file
      try { unlinkSync(localPath); } catch { /* ignore */ }
    }
  };
}
