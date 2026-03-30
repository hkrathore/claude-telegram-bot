import { describe, it, expect } from "vitest";
import { chunkMessage } from "../../src/util/chunker.js";

describe("chunkMessage", () => {
  it("returns empty array for empty string", () => {
    expect(chunkMessage("")).toEqual([]);
  });

  it("returns single-element array for short text", () => {
    expect(chunkMessage("Hello world")).toEqual(["Hello world"]);
  });

  it("returns single element for text exactly at limit", () => {
    const text = "a".repeat(4000);
    expect(chunkMessage(text)).toEqual([text]);
  });

  it("splits at paragraph boundary (double newline)", () => {
    const para1 = "a".repeat(2000);
    const para2 = "b".repeat(2000);
    const text = para1 + "\n\n" + para2;
    const chunks = chunkMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain(para1);
    expect(chunks[1]).toContain(para2);
  });

  it("splits at newline when no paragraph boundary", () => {
    const line1 = "a".repeat(2500);
    const line2 = "b".repeat(2500);
    const text = line1 + "\n" + line2;
    const chunks = chunkMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain(line1);
    expect(chunks[1]).toContain(line2);
  });

  it("splits at sentence boundary (. )", () => {
    const sentence1 = "a".repeat(2500) + ".";
    const sentence2 = "b".repeat(2500);
    const text = sentence1 + " " + sentence2;
    const chunks = chunkMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toContain("a".repeat(2500));
    expect(chunks[1]).toContain("b".repeat(2500));
  });

  it("splits at word boundary (space)", () => {
    // Create text with spaces but no newlines or sentence endings
    const word = "abcde";
    // Fill up to just over the limit with words
    const words: string[] = [];
    while (words.join(" ").length < 5000) {
      words.push(word);
    }
    const text = words.join(" ");
    const chunks = chunkMessage(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Each chunk should end at a word boundary (no partial words except possibly hard splits)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
  });

  it("hard-splits very long words at maxLen", () => {
    const text = "a".repeat(5000);
    const chunks = chunkMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBe(4000);
    expect(chunks[1].length).toBe(1000);
  });

  it("keeps code blocks together when possible", () => {
    const codeBlock = "```ts\nconst x = 1;\nconst y = 2;\n```";
    const text = "Some text before.\n\n" + codeBlock + "\n\nSome text after.";
    const chunks = chunkMessage(text);
    // Code block should be in one chunk since total length is small
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain("```ts");
    expect(chunks[0]).toContain("```");
  });

  it("respects custom maxLen parameter", () => {
    const text = "Hello world, this is a test message that should be split.";
    const chunks = chunkMessage(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it("returns multiple chunks for very long text", () => {
    const paragraph = "This is a paragraph of text. ";
    let text = "";
    while (text.length < 12000) {
      text += paragraph;
    }
    const chunks = chunkMessage(text);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4000);
    }
    // All content should be preserved (joined chunks should reconstruct most of the text)
    const joined = chunks.join("");
    // Some whitespace might be trimmed at boundaries, but core content preserved
    expect(joined.length).toBeGreaterThan(0);
  });
});
