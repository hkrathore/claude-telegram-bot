import { existsSync, statSync } from "node:fs";
import { basename } from "node:path";
import { InputFile } from "grammy";
import type { BotContext } from "../types.js";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Telegram's 50MB limit

/**
 * Scan Claude's response for file paths that were created/modified,
 * and send them back to the Telegram chat as documents.
 *
 * Looks for patterns like:
 *   - "Created file: /path/to/file"
 *   - "Wrote to /path/to/file"
 *   - "Saved to /path/to/file"
 *   - "Output: /path/to/file"
 *   - File paths at start of line after common tool actions
 */
export async function sendOutputFiles(ctx: BotContext, text: string): Promise<void> {
  const paths = extractFilePaths(text);
  if (paths.length === 0) return;

  for (const filePath of paths) {
    try {
      if (!existsSync(filePath)) continue;
      const stat = statSync(filePath);
      if (!stat.isFile()) continue;
      if (stat.size === 0) continue;
      if (stat.size > MAX_FILE_SIZE) {
        await ctx.reply(`File too large for Telegram (${(stat.size / 1024 / 1024).toFixed(1)}MB): ${basename(filePath)}`);
        continue;
      }

      await ctx.replyWithDocument(new InputFile(filePath, basename(filePath)));
    } catch {
      // Skip files we can't send
    }
  }
}

/**
 * Extract file paths from Claude's response text.
 * Returns deduplicated, absolute paths only.
 */
function extractFilePaths(text: string): string[] {
  const patterns = [
    // "Created/Wrote/Saved/Output file at /path" patterns
    /(?:creat|wrot|sav|generat|output|produc|export|download)(?:ed|ing)?\s+(?:file\s+)?(?:at|to|in|:)\s+(\/\S+)/gi,
    // "File: /path" or "Path: /path"
    /(?:file|path|output):\s*(\/\S+)/gi,
    // Backtick-wrapped absolute paths
    /`(\/[^`\s]+)`/g,
  ];

  const found = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let path = match[1];
      // Strip trailing punctuation
      path = path.replace(/[.,;:!?)}\]]+$/, "");
      // Only absolute paths, skip obvious non-files
      if (path.startsWith("/") && !path.includes("*") && path.length > 2) {
        found.add(path);
      }
    }
  }

  return [...found];
}
