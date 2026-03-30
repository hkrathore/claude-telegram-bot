import type { BotCommand } from "../types.js";

// Bot-native commands
export const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show available commands" },
  { command: "model", description: "Switch Claude model (sonnet/opus/haiku)" },
  { command: "workdir", description: "Set working directory" },
  { command: "session", description: "Manage sessions (new/continue)" },
  { command: "cancel", description: "Cancel running operation" },
];

// Claude Code skill commands (underscores because Telegram doesn't allow hyphens)
export const SKILL_COMMANDS: BotCommand[] = [
  { command: "commit", description: "Create a git commit" },
  { command: "commit_push_pr", description: "Commit, push, and create PR" },
  { command: "simplify", description: "Review and simplify code" },
  { command: "humanizer", description: "Remove AI writing patterns" },
  { command: "code_review", description: "Review code changes" },
  { command: "feature_dev", description: "Develop a new feature" },
  { command: "resume_tailor", description: "Tailor resume for a job" },
  { command: "linkedin_draft", description: "Draft LinkedIn content" },
  { command: "linkedin_scrape", description: "Scrape LinkedIn profile" },
  { command: "ralph_loop", description: "Iterative development loop" },
  { command: "cancel_ralph", description: "Cancel active Ralph loop" },
  { command: "clean_gone", description: "Clean up deleted branches" },
];

export const ALL_COMMANDS = [...BOT_COMMANDS, ...SKILL_COMMANDS];

// Map telegram command (underscores) back to Claude skill name (hyphens)
export function toClaudeSkill(telegramCommand: string): string {
  return telegramCommand.replace(/_/g, "-");
}
