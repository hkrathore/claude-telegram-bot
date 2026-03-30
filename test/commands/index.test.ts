import { describe, it, expect } from "vitest";
import {
  toClaudeSkill,
  BOT_COMMANDS,
  BUILTIN_SKILL_COMMANDS,
} from "../../src/commands/index.js";

describe("toClaudeSkill", () => {
  it("converts underscores to hyphens", () => {
    expect(toClaudeSkill("commit_push_pr")).toBe("commit-push-pr");
  });

  it("returns unchanged string when no underscores", () => {
    expect(toClaudeSkill("commit")).toBe("commit");
  });

  it("converts single underscore", () => {
    expect(toClaudeSkill("ralph_loop")).toBe("ralph-loop");
  });
});

describe("BOT_COMMANDS", () => {
  it("has expected entries", () => {
    const commands = BOT_COMMANDS.map((c) => c.command);
    expect(commands).toContain("start");
    expect(commands).toContain("help");
    expect(commands).toContain("model");
    expect(commands).toContain("workdir");
    expect(commands).toContain("session");
    expect(commands).toContain("cancel");
  });

  it("has no command names containing hyphens", () => {
    for (const cmd of BOT_COMMANDS) {
      expect(cmd.command).not.toContain("-");
    }
  });

  it("has all lowercase command names", () => {
    for (const cmd of BOT_COMMANDS) {
      expect(cmd.command).toBe(cmd.command.toLowerCase());
    }
  });

  it("has command names matching /^[a-z0-9_]+$/", () => {
    for (const cmd of BOT_COMMANDS) {
      expect(cmd.command).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe("BUILTIN_SKILL_COMMANDS", () => {
  it("has expected entries", () => {
    const commands = BUILTIN_SKILL_COMMANDS.map((c) => c.command);
    expect(commands).toContain("commit");
    expect(commands).toContain("simplify");
    expect(commands).toContain("commit_push_pr");
    expect(commands).toContain("code_review");
    expect(commands).toContain("feature_dev");
    expect(commands).toContain("ralph_loop");
  });

  it("has no command names containing hyphens", () => {
    for (const cmd of BUILTIN_SKILL_COMMANDS) {
      expect(cmd.command).not.toContain("-");
    }
  });

  it("has all lowercase command names", () => {
    for (const cmd of BUILTIN_SKILL_COMMANDS) {
      expect(cmd.command).toBe(cmd.command.toLowerCase());
    }
  });

  it("has command names matching /^[a-z0-9_]+$/", () => {
    for (const cmd of BUILTIN_SKILL_COMMANDS) {
      expect(cmd.command).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("every command has a non-empty description", () => {
    for (const cmd of BUILTIN_SKILL_COMMANDS) {
      expect(cmd.description.length).toBeGreaterThan(0);
    }
  });
});
