/**
 * Shared per-chat state: tracks active Claude invocations for
 * cancel support, rate limiting, and message queuing.
 */

interface ActiveInvocation {
  abortController: AbortController;
  startedAt: number;
}

const active = new Map<number, ActiveInvocation>();

/** Pending messages queued while a chat is busy. */
interface QueuedMessage {
  prompt: string;
  resolve: () => void;
}

const queues = new Map<number, QueuedMessage[]>();
const MAX_QUEUE_SIZE = 5;

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

/**
 * Queue a message for a chat that's currently busy.
 * Returns null if queued successfully, or an error string if queue is full.
 */
export function enqueueMessage(chatId: number, prompt: string): Promise<void> | null {
  const queue = queues.get(chatId) ?? [];
  if (queue.length >= MAX_QUEUE_SIZE) {
    return null; // queue full
  }

  return new Promise<void>((resolve) => {
    queue.push({ prompt, resolve });
    queues.set(chatId, queue);
  });
}

/**
 * Dequeue the next pending message for a chat.
 * Returns the prompt string, or undefined if nothing queued.
 */
export function dequeueMessage(chatId: number): string | undefined {
  const queue = queues.get(chatId);
  if (!queue || queue.length === 0) return undefined;

  const next = queue.shift()!;
  if (queue.length === 0) {
    queues.delete(chatId);
  }
  next.resolve(); // unblock the waiting handler
  return next.prompt;
}

/** Get current queue size for a chat. */
export function queueSize(chatId: number): number {
  return queues.get(chatId)?.length ?? 0;
}
