import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { BotCommand } from "../types.js";

// Bot-native commands
export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show available commands" },
  { command: "model", description: "Switch Claude model (sonnet/opus/haiku)" },
  { command: "effort", description: "Set effort level (low/medium/high/max/auto)" },
  { command: "workdir", description: "Set working directory" },
  { command: "session", description: "Manage sessions (new/continue)" },
  { command: "cancel", description: "Cancel running operation" },
  { command: "compact", description: "Compress conversation context" },
];

// Built-in Claude Code skill commands (underscores because Telegram doesn't allow hyphens)
export const BUILTIN_SKILL_COMMANDS: BotCommand[] = [
  { command: "commit", description: "Create a git commit" },
  { command: "commit_push_pr", description: "Commit, push, and create PR" },
  { command: "simplify", description: "Review and simplify code" },
  { command: "code_review", description: "Review code changes" },
  { command: "feature_dev", description: "Develop a new feature" },
  { command: "ralph_loop", description: "Iterative development loop" },
  { command: "cancel_ralph", description: "Cancel active Ralph loop" },
  { command: "clean_gone", description: "Clean up deleted branches" },
];

/**
 * Scan ~/.claude/skills/ for custom SKILL.md files.
 * Extracts name and description from YAML frontmatter or markdown heading.
 */
export function discoverCustomSkills(): BotCommand[] {
  const skillsDir = join(homedir(), ".claude", "skills");
  if (!existsSync(skillsDir)) return [];

  const skills: BotCommand[] = [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  for (const dirName of entries) {
    const skillFile = join(skillsDir, dirName, "SKILL.md");
    if (!existsSync(skillFile)) continue;

    try {
      const content = readFileSync(skillFile, "utf-8");
      const { name, description } = parseSkillMd(content, dirName);

      // Convert to Telegram command format:
      // - use directory name (always safe) instead of parsed name (may have spaces)
      // - hyphens -> underscores, strip anything not [a-z0-9_], max 32 chars
      const command = dirName
        .replace(/-/g, "_")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 32);

      // Skip empty or too-short commands
      if (!command) continue;

      // Skip if it collides with a built-in command
      if (BOT_COMMANDS.some((c) => c.command === command)) continue;
      if (BUILTIN_SKILL_COMMANDS.some((c) => c.command === command)) continue;

      // Telegram command descriptions max 256 chars, must not be empty
      const desc = (description.length > 256 ? description.slice(0, 253) + "..." : description) || `Custom skill: ${dirName}`;

      skills.push({ command, description: desc });
    } catch {
      // Skip unparseable skills
    }
  }

  return skills;
}

/** Parse name and description from a SKILL.md file. */
function parseSkillMd(content: string, fallbackName: string): { name: string; description: string } {
  let name = fallbackName;
  let description = `Custom skill: ${fallbackName}`;

  // Try YAML frontmatter: ---\nkey: value\n---
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];

    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    if (nameMatch) name = nameMatch[1].trim();

    // Description: check for multi-line YAML block (|) first, then single line
    const descBlockMatch = fm.match(/^description:\s*\|\s*\n([\s\S]*?)(?=\n[a-zA-Z][\w-]*:|\s*$)/m);
    if (descBlockMatch) {
      const firstLine = descBlockMatch[1].trim().split("\n")[0].trim();
      if (firstLine) description = firstLine;
    } else {
      const descSingleMatch = fm.match(/^description:\s*(.+)$/m);
      if (descSingleMatch) {
        const val = descSingleMatch[1].trim();
        if (val && val !== "|") description = val;
      }
    }
  } else {
    // No frontmatter -- try markdown heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      name = headingMatch[1].trim();
      description = name;
    }
  }

  return { name, description };
}

// All skill commands = built-in + discovered custom
export const CUSTOM_SKILL_COMMANDS = discoverCustomSkills();
export const SKILL_COMMANDS = [...BUILTIN_SKILL_COMMANDS, ...CUSTOM_SKILL_COMMANDS];
export const ALL_COMMANDS = [...BOT_COMMANDS, ...SKILL_COMMANDS];

// Map telegram command (underscores) back to Claude skill name (hyphens)
export function toClaudeSkill(telegramCommand: string): string {
  return telegramCommand.replace(/_/g, "-");
}
