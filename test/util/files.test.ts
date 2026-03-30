import { describe, it, expect, vi, beforeEach } from "vitest";

// We need to test extractFilePaths which is private, so we test through sendOutputFiles
// But sendOutputFiles needs ctx and file system. Let's test the extraction logic by
// mocking fs and testing the public function.

// Actually, let's extract the regex logic by testing sendOutputFiles with mocked fs.
// Simpler: import the module and test file path extraction patterns via the public API.

import { existsSync, statSync } from "node:fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("grammy", () => ({
  InputFile: class InputFile {
    constructor(public path: string, public name: string) {}
  },
}));

const mockedExistsSync = vi.mocked(existsSync);
const mockedStatSync = vi.mocked(statSync);

// Import after mocks
const { sendOutputFiles } = await import("../../src/util/files.js");

function createMockCtx() {
  return {
    reply: vi.fn(),
    replyWithDocument: vi.fn(),
  } as any;
}

describe("sendOutputFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing for text with no file paths", async () => {
    const ctx = createMockCtx();
    await sendOutputFiles(ctx, "Hello, this is just text.");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it("detects 'Created file: /path' pattern", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Created file at /tmp/output.txt");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("detects 'Wrote to /path' pattern", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Wrote to /home/user/result.json");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("detects 'Saved to /path' pattern", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Saved to /tmp/data.csv");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("detects 'Generated /path' pattern", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Generated file at /tmp/report.pdf");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("detects backtick-wrapped paths", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "The file is at `/tmp/script.sh`");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("detects 'File: /path' pattern", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Output: /tmp/build.log");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("skips non-existent files", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(false);

    await sendOutputFiles(ctx, "Created file at /tmp/ghost.txt");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it("skips directories", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => false, size: 100 } as any);

    await sendOutputFiles(ctx, "Created file at /tmp/somedir");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it("skips empty files", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 0 } as any);

    await sendOutputFiles(ctx, "Created file at /tmp/empty.txt");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });

  it("warns about files over 50MB", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 60 * 1024 * 1024 } as any);

    await sendOutputFiles(ctx, "Created file at /tmp/huge.bin");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining("too large"));
  });

  it("deduplicates same path mentioned multiple times", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Created file at /tmp/out.txt. The file `/tmp/out.txt` is ready.");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(1);
  });

  it("handles multiple different files", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Wrote to /tmp/a.txt and saved to /tmp/b.txt");
    expect(ctx.replyWithDocument).toHaveBeenCalledTimes(2);
  });

  it("strips trailing punctuation from paths", async () => {
    const ctx = createMockCtx();
    mockedExistsSync.mockReturnValue(true);
    mockedStatSync.mockReturnValue({ isFile: () => true, size: 100 } as any);

    await sendOutputFiles(ctx, "Saved to /tmp/result.txt.");
    expect(mockedExistsSync).toHaveBeenCalledWith("/tmp/result.txt");
  });

  it("ignores relative paths", async () => {
    const ctx = createMockCtx();
    await sendOutputFiles(ctx, "Created file at ./relative/path.txt");
    expect(ctx.replyWithDocument).not.toHaveBeenCalled();
  });
});
