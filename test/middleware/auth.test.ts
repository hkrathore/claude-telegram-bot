import { describe, it, expect, vi } from "vitest";
import { authMiddleware } from "../../src/middleware/auth.js";

function createMockCtx(userId?: number) {
  return {
    from: userId ? { id: userId } : undefined,
    reply: vi.fn(),
  } as any;
}

describe("authMiddleware", () => {
  it("calls next() for allowed user ID", async () => {
    const mw = authMiddleware(new Set([123, 456]));
    const ctx = createMockCtx(123);
    const next = vi.fn();

    await mw(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("does NOT call next() for disallowed user ID", async () => {
    const mw = authMiddleware(new Set([123, 456]));
    const ctx = createMockCtx(999);
    const next = vi.fn();

    await mw(ctx, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("replies with Unauthorized for disallowed user", async () => {
    const mw = authMiddleware(new Set([123]));
    const ctx = createMockCtx(999);
    const next = vi.fn();

    await mw(ctx, next);

    expect(ctx.reply).toHaveBeenCalledOnce();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Unauthorized"),
    );
  });

  it("does NOT call next() when from is missing (no user)", async () => {
    const mw = authMiddleware(new Set([123]));
    const ctx = createMockCtx(); // no userId
    const next = vi.fn();

    await mw(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });

  it("blocks everyone when allowlist is empty", async () => {
    const mw = authMiddleware(new Set());
    const ctx = createMockCtx(123);
    const next = vi.fn();

    await mw(ctx, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalled();
  });
});
