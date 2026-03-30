/**
 * Split a long message into chunks that respect Telegram's 4096-char limit.
 *
 * Priority for split points:
 * 1. Never split inside a code fence (```...```)
 * 2. Paragraph boundary (double newline)
 * 3. Sentence boundary (. ! ?)
 * 4. Word boundary (space)
 * 5. Hard split at maxLen
 *
 * If a single code block exceeds maxLen it is split across chunks with
 * the fence re-opened / re-closed at chunk boundaries.
 */

const DEFAULT_MAX = 4000;

export function chunkMessage(text: string, maxLen: number = DEFAULT_MAX): string[] {
  if (!text) return [];
  if (text.length <= maxLen) return [text];

  // Tokenize into segments: alternating text and code blocks.
  const segments = splitByCodeBlocks(text);
  const chunks: string[] = [];
  let current = "";

  for (const seg of segments) {
    if (seg.type === "text") {
      current = appendText(current, seg.content, maxLen, chunks);
    } else {
      // Code block – try to keep it whole
      const block = seg.content;
      if ((current + block).length <= maxLen) {
        current += block;
      } else {
        // Flush what we have
        if (current) {
          chunks.push(current);
          current = "";
        }
        if (block.length <= maxLen) {
          current = block;
        } else {
          // Code block itself exceeds limit – split it
          const codeChunks = splitLargeCodeBlock(seg, maxLen);
          for (let i = 0; i < codeChunks.length; i++) {
            if (i < codeChunks.length - 1) {
              chunks.push(codeChunks[i]);
            } else {
              current = codeChunks[i];
            }
          }
        }
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

// ---- Internal helpers ----

interface Segment {
  type: "text" | "code";
  content: string;
  lang?: string;
}

function splitByCodeBlocks(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(```(\w*)\n?[\s\S]*?```)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    // Extract language hint
    const langMatch = match[0].match(/^```(\w*)/);
    segments.push({
      type: "code",
      content: match[0],
      lang: langMatch?.[1] || "",
    });
    lastIndex = regex.lastIndex;
  }

  // Handle unclosed code fence – treat remainder as text
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Append plain text to `current`, flushing to `chunks` when needed.
 * Returns the new value of `current`.
 */
function appendText(
  current: string,
  text: string,
  maxLen: number,
  chunks: string[],
): string {
  let remaining = text;

  while (remaining.length > 0) {
    const space = maxLen - current.length;
    if (remaining.length <= space) {
      current += remaining;
      remaining = "";
    } else {
      // Need to split – find best break point within `space` chars
      const slice = remaining.slice(0, space);
      const breakIdx = findBreakPoint(slice);

      if (breakIdx > 0) {
        current += slice.slice(0, breakIdx);
        chunks.push(current);
        current = "";
        remaining = remaining.slice(breakIdx).replace(/^\n/, "");
      } else if (current.length > 0) {
        // Can't find a good break in the slice; flush current first
        chunks.push(current);
        current = "";
      } else {
        // Nothing in current and no break found – hard split
        current = slice;
        chunks.push(current);
        current = "";
        remaining = remaining.slice(space);
      }
    }
  }

  return current;
}

/** Find the best break point index within a string, searching from the end. */
function findBreakPoint(text: string): number {
  // Paragraph boundary (double newline)
  const para = text.lastIndexOf("\n\n");
  if (para > 0) return para + 2;

  // Single newline
  const nl = text.lastIndexOf("\n");
  if (nl > 0) return nl + 1;

  // Sentence boundary
  const sentence = Math.max(
    text.lastIndexOf(". "),
    text.lastIndexOf("! "),
    text.lastIndexOf("? "),
  );
  if (sentence > 0) return sentence + 2;

  // Word boundary
  const word = text.lastIndexOf(" ");
  if (word > 0) return word + 1;

  return 0; // no good break found
}

/** Split a code block that exceeds maxLen into multiple chunks. */
function splitLargeCodeBlock(seg: Segment, maxLen: number): string[] {
  const lang = seg.lang || "";
  const openFence = "```" + lang + "\n";
  const closeFence = "\n```";
  const overhead = openFence.length + closeFence.length;

  // Extract the inner code (strip opening/closing fences)
  let inner = seg.content;
  inner = inner.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");

  const chunkSize = maxLen - overhead;
  const result: string[] = [];
  let pos = 0;

  while (pos < inner.length) {
    let end = Math.min(pos + chunkSize, inner.length);
    // Try to break at a newline
    if (end < inner.length) {
      const nl = inner.lastIndexOf("\n", end);
      if (nl > pos) end = nl + 1;
    }
    const slice = inner.slice(pos, end);
    result.push(openFence + slice.replace(/\n$/, "") + closeFence);
    pos = end;
  }

  return result;
}
