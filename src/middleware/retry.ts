import { InlineKeyboard } from "grammy";

/** Store the last failed prompt per chat for retry. */
const failedPrompts = new Map<number, string>();

export function storeFailedPrompt(chatId: number, prompt: string): void {
  failedPrompts.set(chatId, prompt);
}

export function getFailedPrompt(chatId: number): string | undefined {
  return failedPrompts.get(chatId);
}

export function clearFailedPrompt(chatId: number): void {
  failedPrompts.delete(chatId);
}

export function retryKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Retry", "retry");
}
