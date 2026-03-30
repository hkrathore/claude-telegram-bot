import type { Context } from "grammy";

export interface SessionData {
  claudeSessionId: string | null;
  model: string;
  workingDir: string;
  lastActivity: number;
}

export interface BotContext extends Context {
  session?: SessionData;
}

export interface BotCommand {
  command: string;
  description: string;
}
