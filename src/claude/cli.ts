import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Config } from "../config.js";
import type {
  ClaudeInvocation,
  ClaudeStreamEvent,
  ClaudeRawEvent,
  AssistantContentBlock,
} from "./types.js";

/**
 * Invoke Claude CLI in streaming mode and emit parsed events.
 *
 * Spawns `claude -p <prompt> --output-format stream-json --verbose` and
 * parses each stdout line as a JSON event, translating raw CLI events
 * into simplified ClaudeStreamEvent objects for the bot layer.
 */
export async function invokeClaude(
  config: Config,
  invocation: ClaudeInvocation,
  onEvent: (event: ClaudeStreamEvent) => void,
): Promise<{ fullText: string; sessionId: string; costUsd?: number }> {
  const model = invocation.model ?? config.claudeModel;
  const binary = config.claudeBinary;

  const args: string[] = [
    "-p",
    invocation.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
  ];

  if (invocation.sessionId) {
    args.push("--resume", invocation.sessionId);
  }

  if (invocation.allowedTools && invocation.allowedTools.length > 0) {
    args.push("--allowedTools", ...invocation.allowedTools);
  }

  const budgetUsd = invocation.maxBudgetUsd ?? config.maxBudgetUsd;
  if (budgetUsd !== undefined) {
    args.push("--max-budget-usd", String(budgetUsd));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: invocation.workingDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    });

    let fullText = "";
    let sessionId = invocation.sessionId ?? "";
    let costUsd: number | undefined;
    let stderrChunks: string[] = [];

    // Handle abort signal
    if (invocation.abortSignal) {
      const onAbort = () => {
        child.kill("SIGTERM");
        // Give it a moment, then force kill
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 3000);
      };

      if (invocation.abortSignal.aborted) {
        child.kill("SIGTERM");
        reject(new Error("Aborted"));
        return;
      }

      invocation.abortSignal.addEventListener("abort", onAbort, { once: true });
      child.on("exit", () => {
        invocation.abortSignal!.removeEventListener("abort", onAbort);
      });
    }

    // Parse stdout line by line
    const rl = createInterface({ input: child.stdout! });

    rl.on("line", (line: string) => {
      if (!line.trim()) return;

      let raw: ClaudeRawEvent;
      try {
        raw = JSON.parse(line);
      } catch {
        // Non-JSON output, ignore
        return;
      }

      switch (raw.type) {
        case "system": {
          sessionId = raw.session_id;
          onEvent({ type: "system", sessionId: raw.session_id, model: raw.model });
          break;
        }

        case "assistant": {
          const blocks: AssistantContentBlock[] = raw.message?.content ?? [];
          for (const block of blocks) {
            if (block.type === "text") {
              fullText += block.text;
              onEvent({ type: "assistant", content: block.text });
            } else if (block.type === "tool_use") {
              const inputStr =
                typeof block.input === "string"
                  ? block.input
                  : JSON.stringify(block.input, null, 2);
              onEvent({ type: "tool_use", tool: block.name, input: inputStr });
            }
          }
          break;
        }

        case "result": {
          costUsd = raw.total_cost_usd;
          sessionId = raw.session_id || sessionId;
          // Result text is the authoritative final output
          if (raw.result && !raw.is_error) {
            fullText = raw.result;
            onEvent({
              type: "result",
              content: raw.result,
              sessionId: raw.session_id,
              costUsd: raw.total_cost_usd,
              turns: raw.num_turns,
            });
          } else if (raw.is_error) {
            onEvent({ type: "error", content: raw.result || "Unknown error from Claude CLI" });
          }
          break;
        }

        case "rate_limit_event": {
          // Informational, no action needed
          break;
        }

        default: {
          // Unknown event type, ignore
          break;
        }
      }
    });

    // Capture stderr
    child.stderr!.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    child.on("error", (err: Error) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });

    child.on("exit", (code: number | null, signal: string | null) => {
      rl.close();

      if (signal === "SIGTERM" || signal === "SIGKILL") {
        reject(new Error("Claude CLI was aborted"));
        return;
      }

      if (code !== 0 && code !== null) {
        const stderr = stderrChunks.join("");
        const errMsg = stderr.trim() || `Claude CLI exited with code ${code}`;
        onEvent({ type: "error", content: errMsg });
        reject(new Error(errMsg));
        return;
      }

      resolve({ fullText, sessionId, costUsd });
    });
  });
}
