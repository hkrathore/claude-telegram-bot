/**
 * Convert Claude's Markdown output to Telegram-compatible HTML.
 *
 * Telegram supports a limited subset of HTML (b, i, u, s, code, pre, a).
 * We process code blocks first so their contents get HTML-escaped but
 * no further markdown transformations are applied inside them.
 */

/** Escape characters that are special in HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownToTelegramHtml(markdown: string): string {
  if (!markdown) return "";

  // ---- Step 1: Extract code blocks so they aren't mangled ----
  // We replace them with placeholders, convert the rest, then put them back.

  const codeBlocks: string[] = [];
  const CODE_PH = "\x00CB";

  // Fenced code blocks: ```lang\n...\n```
  let text = markdown.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_match, lang: string, code: string) => {
      const escaped = escapeHtml(code.replace(/\n$/, ""));
      const langAttr = lang ? ` class="language-${lang}"` : "";
      codeBlocks.push(`<pre><code${langAttr}>${escaped}</code></pre>`);
      return `${CODE_PH}${codeBlocks.length - 1}${CODE_PH}`;
    },
  );

  // Handle unclosed code fences – treat everything after ``` as a code block
  text = text.replace(/```(\w*)\n?([\s\S]*)$/g, (_match, lang: string, code: string) => {
    const escaped = escapeHtml(code.replace(/\n$/, ""));
    const langAttr = lang ? ` class="language-${lang}"` : "";
    codeBlocks.push(`<pre><code${langAttr}>${escaped}</code></pre>`);
    return `${CODE_PH}${codeBlocks.length - 1}${CODE_PH}`;
  });

  // Inline code: `code`
  const inlineBlocks: string[] = [];
  const INLINE_PH = "\x00IC";

  text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => {
    inlineBlocks.push(`<code>${escapeHtml(code)}</code>`);
    return `${INLINE_PH}${inlineBlocks.length - 1}${INLINE_PH}`;
  });

  // ---- Step 2: HTML-escape the remaining text ----
  text = escapeHtml(text);

  // ---- Step 3: Markdown → Telegram HTML conversions ----

  // Headers → bold (strip # prefix)
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ (but not inside words with underscores like foo_bar_baz)
  // Use word-boundary-aware patterns for underscore variant
  text = text.replace(/\*([^\s*][^*]*?[^\s*])\*/g, "<i>$1</i>");
  text = text.replace(/\*([^\s*])\*/g, "<i>$1</i>");
  text = text.replace(/(?<![a-zA-Z0-9])_([^\s_][^_]*?[^\s_])_(?![a-zA-Z0-9])/g, "<i>$1</i>");
  text = text.replace(/(?<![a-zA-Z0-9])_([^\s_])_(?![a-zA-Z0-9])/g, "<i>$1</i>");

  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Links: [text](url) – note: < > & in the URL were already escaped
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  );

  // Horizontal rules
  text = text.replace(/^---+$/gm, "");

  // ---- Step 4: Restore code blocks ----
  text = text.replace(
    new RegExp(`${INLINE_PH}(\\d+)${INLINE_PH}`, "g"),
    (_match, idx: string) => inlineBlocks[parseInt(idx, 10)],
  );

  text = text.replace(
    new RegExp(`${CODE_PH}(\\d+)${CODE_PH}`, "g"),
    (_match, idx: string) => codeBlocks[parseInt(idx, 10)],
  );

  return text;
}
