/**
 * Parameters for invoking Claude CLI.
 */
export interface ClaudeInvocation {
  prompt: string;
  sessionId?: string;
  model?: string;
  workingDir: string;
  allowedTools?: string[];
  maxBudgetUsd?: number;
  abortSignal?: AbortSignal;
}

/**
 * Events emitted from Claude CLI's --output-format stream-json.
 *
 * Based on actual CLI output, each line is a JSON object with a "type" field:
 *   - "system"     : init event with session_id, model, tools, etc.
 *   - "assistant"  : assistant message with content blocks (text, tool_use)
 *   - "result"     : final result with aggregated text, cost, session_id
 *   - "rate_limit_event" : rate limit info (informational, usually ignored)
 */
export interface ClaudeSystemEvent {
  type: "system";
  subtype: "init";
  session_id: string;
  model: string;
  cwd: string;
}

export interface ClaudeAssistantEvent {
  type: "assistant";
  message: {
    id: string;
    role: "assistant";
    model: string;
    content: AssistantContentBlock[];
    stop_reason: string | null;
    usage: Record<string, unknown>;
  };
  session_id: string;
}

export type AssistantContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface ClaudeResultEvent {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  result: string;
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  stop_reason?: string;
  usage?: Record<string, unknown>;
}

export interface ClaudeRateLimitEvent {
  type: "rate_limit_event";
  rate_limit_info: Record<string, unknown>;
  session_id: string;
}

/** Union of all possible raw events from the CLI stream. */
export type ClaudeRawEvent =
  | ClaudeSystemEvent
  | ClaudeAssistantEvent
  | ClaudeResultEvent
  | ClaudeRateLimitEvent;

/**
 * Simplified stream events emitted to the bot layer.
 */
export type ClaudeStreamEvent =
  | { type: "system"; sessionId: string; model: string }
  | { type: "assistant"; content: string }
  | { type: "tool_use"; tool: string; input: string }
  | { type: "result"; content: string; sessionId: string; costUsd: number; turns: number }
  | { type: "error"; content: string };
