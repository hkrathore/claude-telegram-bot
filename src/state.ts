/**
 * Shared per-chat state: tracks active Claude invocations for
 * cancel support and rate limiting (one invocation at a time per chat).
 */

interface ActiveInvocation {
  abortController: AbortController;
  startedAt: number;
}

const active = new Map<number, ActiveInvocation>();

/** Register a new invocation for a chat. Returns the AbortController. */
export function startInvocation(chatId: number): AbortController {
  const controller = new AbortController();
  active.set(chatId, { abortController: controller, startedAt: Date.now() });
  return controller;
}

/** Clear the active invocation for a chat. */
export function clearInvocation(chatId: number): void {
  active.delete(chatId);
}

/** Check if a chat has an active invocation. */
export function isActive(chatId: number): boolean {
  return active.has(chatId);
}

/** Abort the active invocation for a chat. Returns true if there was one. */
export function cancelInvocation(chatId: number): boolean {
  const entry = active.get(chatId);
  if (!entry) return false;
  entry.abortController.abort();
  active.delete(chatId);
  return true;
}
