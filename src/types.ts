import type { Context } from "grammy";

export interface BotContext extends Context {}

export interface BotCommand {
  command: string;
  description: string;
}
