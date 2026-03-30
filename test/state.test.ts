import { describe, it, expect, beforeEach } from "vitest";
import {
  startInvocation,
  clearInvocation,
  isActive,
  cancelInvocation,
  enqueueMessage,
  dequeueMessage,
  queueSize,
} from "../src/state.js";

describe("state - active invocations", () => {
  const chatId = 12345;

  beforeEach(() => {
    clearInvocation(chatId);
    // drain any leftover queue
    while (dequeueMessage(chatId)) {}
  });

  it("isActive returns false for unknown chat", () => {
    expect(isActive(99999)).toBe(false);
  });

  it("startInvocation makes chat active", () => {
    startInvocation(chatId);
    expect(isActive(chatId)).toBe(true);
  });

  it("clearInvocation makes chat inactive", () => {
    startInvocation(chatId);
    clearInvocation(chatId);
    expect(isActive(chatId)).toBe(false);
  });

  it("startInvocation returns an AbortController", () => {
    const controller = startInvocation(chatId);
    expect(controller).toBeInstanceOf(AbortController);
    expect(controller.signal.aborted).toBe(false);
  });

  it("cancelInvocation aborts the controller and returns true", () => {
    const controller = startInvocation(chatId);
    const result = cancelInvocation(chatId);
    expect(result).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(isActive(chatId)).toBe(false);
  });

  it("cancelInvocation returns false when nothing active", () => {
    expect(cancelInvocation(chatId)).toBe(false);
  });
});

describe("state - message queue", () => {
  const chatId = 54321;

  beforeEach(() => {
    clearInvocation(chatId);
    while (dequeueMessage(chatId)) {}
  });

  it("queueSize is 0 for empty queue", () => {
    expect(queueSize(chatId)).toBe(0);
  });

  it("enqueueMessage returns a promise", () => {
    const result = enqueueMessage(chatId, "hello");
    expect(result).toBeInstanceOf(Promise);
  });

  it("queueSize increases after enqueue", () => {
    enqueueMessage(chatId, "msg1");
    enqueueMessage(chatId, "msg2");
    expect(queueSize(chatId)).toBe(2);
  });

  it("dequeueMessage returns the prompt in FIFO order", () => {
    enqueueMessage(chatId, "first");
    enqueueMessage(chatId, "second");
    expect(dequeueMessage(chatId)).toBe("first");
    expect(dequeueMessage(chatId)).toBe("second");
  });

  it("dequeueMessage returns undefined when empty", () => {
    expect(dequeueMessage(chatId)).toBeUndefined();
  });

  it("queueSize decreases after dequeue", () => {
    enqueueMessage(chatId, "msg1");
    enqueueMessage(chatId, "msg2");
    dequeueMessage(chatId);
    expect(queueSize(chatId)).toBe(1);
  });

  it("dequeue resolves the enqueued promise", async () => {
    let resolved = false;
    const promise = enqueueMessage(chatId, "test");
    promise!.then(() => { resolved = true; });
    expect(resolved).toBe(false);
    dequeueMessage(chatId);
    await promise;
    expect(resolved).toBe(true);
  });

  it("rejects when queue is full (max 5)", () => {
    enqueueMessage(chatId, "1");
    enqueueMessage(chatId, "2");
    enqueueMessage(chatId, "3");
    enqueueMessage(chatId, "4");
    enqueueMessage(chatId, "5");
    const result = enqueueMessage(chatId, "6");
    expect(result).toBeNull();
    expect(queueSize(chatId)).toBe(5);
  });

  it("can enqueue again after draining", () => {
    enqueueMessage(chatId, "1");
    dequeueMessage(chatId);
    expect(queueSize(chatId)).toBe(0);
    const result = enqueueMessage(chatId, "new");
    expect(result).toBeInstanceOf(Promise);
    expect(queueSize(chatId)).toBe(1);
  });
});
