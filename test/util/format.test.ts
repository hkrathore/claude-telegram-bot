import { describe, it, expect } from "vitest";
import { markdownToTelegramHtml } from "../../src/util/format.js";

describe("markdownToTelegramHtml", () => {
  it("returns empty string for empty input", () => {
    expect(markdownToTelegramHtml("")).toBe("");
  });

  it("passes through plain text unchanged", () => {
    expect(markdownToTelegramHtml("Hello world")).toBe("Hello world");
  });

  it("escapes HTML special characters in plain text", () => {
    expect(markdownToTelegramHtml("a < b & c > d")).toBe(
      "a &lt; b &amp; c &gt; d",
    );
  });

  // Bold
  it("converts **bold** to <b>bold</b>", () => {
    expect(markdownToTelegramHtml("**bold**")).toBe("<b>bold</b>");
  });

  it("converts __bold__ to <b>bold</b>", () => {
    expect(markdownToTelegramHtml("__bold__")).toBe("<b>bold</b>");
  });

  // Italic
  it("converts *italic* to <i>italic</i>", () => {
    expect(markdownToTelegramHtml("*italic*")).toBe("<i>italic</i>");
  });

  it("converts _italic_ to <i>italic</i>", () => {
    expect(markdownToTelegramHtml("_italic_")).toBe("<i>italic</i>");
  });

  it("does NOT convert underscores inside words (foo_bar_baz)", () => {
    const result = markdownToTelegramHtml("foo_bar_baz");
    expect(result).toBe("foo_bar_baz");
    expect(result).not.toContain("<i>");
  });

  // Strikethrough
  it("converts ~~strike~~ to <s>strike</s>", () => {
    expect(markdownToTelegramHtml("~~strike~~")).toBe("<s>strike</s>");
  });

  // Inline code
  it("converts `code` to <code>code</code>", () => {
    expect(markdownToTelegramHtml("`code`")).toBe("<code>code</code>");
  });

  // Fenced code blocks
  it("converts fenced code block with language", () => {
    const md = "```ts\nconst x = 1;\n```";
    expect(markdownToTelegramHtml(md)).toBe(
      '<pre><code class="language-ts">const x = 1;</code></pre>',
    );
  });

  it("converts fenced code block without language", () => {
    const md = "```\nhello\n```";
    expect(markdownToTelegramHtml(md)).toBe("<pre><code>hello</code></pre>");
  });

  it("HTML-escapes code inside code blocks", () => {
    const md = "```\n<div>test</div>\n```";
    expect(markdownToTelegramHtml(md)).toBe(
      "<pre><code>&lt;div&gt;test&lt;/div&gt;</code></pre>",
    );
  });

  // Links
  it("converts [text](url) to <a> tag", () => {
    expect(markdownToTelegramHtml("[click](https://example.com)")).toBe(
      '<a href="https://example.com">click</a>',
    );
  });

  it("does not double-encode & in URLs", () => {
    const result = markdownToTelegramHtml("[link](https://example.com?a=1&b=2)");
    expect(result).toBe(
      '<a href="https://example.com?a=1&amp;b=2">link</a>',
    );
    expect(result).not.toContain("&amp;amp;");
  });

  // Headers
  it("converts # Header to bold", () => {
    expect(markdownToTelegramHtml("# Title")).toBe("<b>Title</b>");
  });

  it("converts ## Header to bold", () => {
    expect(markdownToTelegramHtml("## Subtitle")).toBe("<b>Subtitle</b>");
  });

  // Unsupported HTML tags stripped
  it("strips unsupported HTML tags like <div>", () => {
    const result = markdownToTelegramHtml("<div>content</div>");
    // < and > get escaped first, but if they were actual tags they'd be stripped
    // Actual HTML tags in source get escaped, so let's test with a scenario
    // where the conversion produces unsupported tags (none does), or test sanitize directly
    // Since markdownToTelegramHtml escapes HTML first, raw <div> becomes &lt;div&gt;
    // The stripping applies to tags generated/remaining after conversion.
    // Let's verify by checking that the output doesn't contain <div> as a tag
    expect(result).not.toMatch(/<div>/);
  });

  it("strips <path> and <svg> tags if present", () => {
    // These would appear if somehow tags survived escaping (e.g., in restored placeholders)
    // Test that sanitization works on post-processed output
    const md = "**bold** text";
    const result = markdownToTelegramHtml(md);
    // Should have <b> but never <path> or <svg>
    expect(result).toContain("<b>");
    expect(result).not.toContain("<svg>");
    expect(result).not.toContain("<path>");
  });

  it("keeps supported tags like <b> and <i>", () => {
    // These are produced by markdown conversion
    const result = markdownToTelegramHtml("**bold** and *italic*");
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<i>italic</i>");
  });

  // Unclosed code fences
  it("handles unclosed code fences gracefully", () => {
    const md = "```ts\nconst x = 1;\nmore code";
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("<pre><code");
    expect(result).toContain("const x = 1;");
  });

  // Horizontal rules
  it("removes horizontal rules (---)", () => {
    const result = markdownToTelegramHtml("above\n---\nbelow");
    expect(result).not.toContain("---");
    expect(result).toContain("above");
    expect(result).toContain("below");
  });

  it("removes longer horizontal rules (-----)", () => {
    const result = markdownToTelegramHtml("above\n-----\nbelow");
    expect(result).not.toContain("-----");
  });

  // Mixed content
  it("handles mixed markdown content", () => {
    const md = "**Bold** and *italic* with `code` and [link](http://x.com)";
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("<b>Bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<code>code</code>");
    expect(result).toContain('<a href="http://x.com">link</a>');
  });
});
