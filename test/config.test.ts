import { describe, it, expect, beforeEach } from "vitest";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

async function loadConfigFresh() {
  const mod = await import("../src/config.js?" + Date.now());
  return mod.loadConfig();
}

describe("loadConfig", () => {
  it("throws if TELEGRAM_BOT_TOKEN is missing", async () => {
    // Set to empty string rather than deleting, because dotenv (which runs on
    // import) would re-populate the var from .env if it's absent.  dotenv
    // does NOT override existing vars, so an empty string stays empty.
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.ALLOWED_USER_IDS = "123";
    await expect(loadConfigFresh()).rejects.toThrow("TELEGRAM_BOT_TOKEN");
  });

  it("throws if ALLOWED_USER_IDS is missing", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    delete process.env.ALLOWED_USER_IDS;
    await expect(loadConfigFresh()).rejects.toThrow("ALLOWED_USER_IDS");
  });

  it("throws if ALLOWED_USER_IDS is empty string", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "";
    await expect(loadConfigFresh()).rejects.toThrow("ALLOWED_USER_IDS");
  });

  it("throws if ALLOWED_USER_IDS contains non-numeric value", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123,abc,456";
    await expect(loadConfigFresh()).rejects.toThrow("Invalid user ID");
  });

  it("defaults model to sonnet and claudeBinary to claude", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    delete process.env.CLAUDE_MODEL;
    delete process.env.CLAUDE_BINARY;
    const config = await loadConfigFresh();
    expect(config.claudeModel).toBe("sonnet");
    expect(config.claudeBinary).toBe("claude");
  });

  it("parses ALLOWED_USER_IDS correctly (comma separated, trims whitespace)", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = " 111 , 222 , 333 ";
    const config = await loadConfigFresh();
    expect(config.allowedUserIds).toEqual(new Set([111, 222, 333]));
  });

  it("parses MAX_BUDGET_USD as number", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.MAX_BUDGET_USD = "50.5";
    const config = await loadConfigFresh();
    expect(config.maxBudgetUsd).toBe(50.5);
  });

  it("converts SESSION_TTL_HOURS to milliseconds", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.SESSION_TTL_HOURS = "2";
    const config = await loadConfigFresh();
    expect(config.sessionTtlMs).toBe(2 * 60 * 60 * 1000);
  });

  it("webhook config is null when WEBHOOK_URL not set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    delete process.env.WEBHOOK_URL;
    const config = await loadConfigFresh();
    expect(config.webhook).toBeNull();
  });

  it("webhook config populated when WEBHOOK_URL set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.WEBHOOK_URL = "https://example.com/webhook";
    process.env.WEBHOOK_PORT = "3000";
    process.env.WEBHOOK_SECRET = "my-secret";
    const config = await loadConfigFresh();
    expect(config.webhook).not.toBeNull();
    expect(config.webhook!.url).toBe("https://example.com/webhook");
    expect(config.webhook!.port).toBe(3000);
    expect(config.webhook!.secret).toBe("my-secret");
  });

  it("ALLOWED_WORKDIR_BASE is undefined when not set", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    delete process.env.ALLOWED_WORKDIR_BASE;
    const config = await loadConfigFresh();
    expect(config.allowedWorkdirBase).toBeUndefined();
  });

  it("ALLOWED_WORKDIR_BASE is set when provided", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.ALLOWED_WORKDIR_BASE = "/home/user/projects";
    const config = await loadConfigFresh();
    expect(config.allowedWorkdirBase).toBe("/home/user/projects");
  });

  it("empty string CLAUDE_MODEL falls back to default", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.CLAUDE_MODEL = "";
    const config = await loadConfigFresh();
    expect(config.claudeModel).toBe("sonnet");
  });

  it("empty string CLAUDE_BINARY falls back to default", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.ALLOWED_USER_IDS = "123";
    process.env.CLAUDE_BINARY = "";
    const config = await loadConfigFresh();
    expect(config.claudeBinary).toBe("claude");
  });
});
