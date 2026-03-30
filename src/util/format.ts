/**
 * Convert Claude's Markdown output to Telegram-compatible HTML.
 *
 * Telegram supports a limited subset of HTML (b, i, u, s, code, pre, a).
 * We extract code blocks and links first so their contents are handled
 * correctly, then HTML-escape and convert the remaining markdown.
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

  // Handle unclosed code fences
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

  // ---- Step 1b: Extract links before HTML-escaping ----
  // This prevents URLs from getting double-encoded (&amp; in href)
  const linkBlocks: string[] = [];
  const LINK_PH = "\x00LK";

  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, url: string) => {
    const escapedText = escapeHtml(linkText);
    // URL needs & escaped for XML but not double-escaped
    const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    linkBlocks.push(`<a href="${safeUrl}">${escapedText}</a>`);
    return `${LINK_PH}${linkBlocks.length - 1}${LINK_PH}`;
  });

  // ---- Step 2: HTML-escape the remaining text ----
  text = escapeHtml(text);

  // ---- Step 3: Markdown → Telegram HTML conversions ----

  // Headers → bold (strip # prefix)
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // Bold: **text** or __text__
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__(.+?)__/g, "<b>$1</b>");

  // Italic: *text* or _text_ (but not inside words with underscores)
  text = text.replace(/\*([^\s*][^*]*?[^\s*])\*/g, "<i>$1</i>");
  text = text.replace(/\*([^\s*])\*/g, "<i>$1</i>");
  text = text.replace(/(?<![a-zA-Z0-9])_([^\s_][^_]*?[^\s_])_(?![a-zA-Z0-9])/g, "<i>$1</i>");
  text = text.replace(/(?<![a-zA-Z0-9])_([^\s_])_(?![a-zA-Z0-9])/g, "<i>$1</i>");

  // Strikethrough: ~~text~~
  text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Horizontal rules
  text = text.replace(/^---+$/gm, "");

  // ---- Step 4: Restore placeholders ----
  text = text.replace(
    new RegExp(`${INLINE_PH}(\\d+)${INLINE_PH}`, "g"),
    (_match, idx: string) => inlineBlocks[parseInt(idx, 10)],
  );

  text = text.replace(
    new RegExp(`${LINK_PH}(\\d+)${LINK_PH}`, "g"),
    (_match, idx: string) => linkBlocks[parseInt(idx, 10)],
  );

  text = text.replace(
    new RegExp(`${CODE_PH}(\\d+)${CODE_PH}`, "g"),
    (_match, idx: string) => codeBlocks[parseInt(idx, 10)],
  );

  // ---- Step 5: Strip any HTML tags Telegram doesn't support ----
  text = sanitizeTelegramHtml(text);

  return text;
}

const ALLOWED_TAGS = new Set(["b", "i", "u", "s", "strike", "del", "code", "pre", "a", "tg-spoiler", "blockquote"]);

/**
 * Remove any HTML tags that Telegram doesn't support.
 * Keeps allowed tags intact, strips everything else.
 */
function sanitizeTelegramHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*\/?>/g, (match, tagName: string) => {
    const tag = tagName.toLowerCase();
    if (ALLOWED_TAGS.has(tag)) return match;
    return "";
  });
}
