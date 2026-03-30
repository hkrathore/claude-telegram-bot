import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SessionEntry {
  claudeSessionId: string;
  model: string;
  workingDir: string;
  lastActivity: number;
}

const STORE_DIR = join(homedir(), ".claude-telegram-bot");
const STORE_FILE = join(STORE_DIR, "sessions.json");

export class SessionStore {
  private sessions: Map<number, SessionEntry>;
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
    this.sessions = this.load();
  }

  get(chatId: number): SessionEntry | undefined {
    const entry = this.sessions.get(chatId);
    if (!entry) return undefined;

    if (Date.now() - entry.lastActivity > this.ttlMs) {
      this.sessions.delete(chatId);
      this.persist();
      return undefined;
    }

    return entry;
  }

  set(chatId: number, entry: SessionEntry): void {
    this.sessions.set(chatId, entry);
    this.persist();
  }

  delete(chatId: number): void {
    this.sessions.delete(chatId);
    this.persist();
  }

  /** Remove all entries that have exceeded the TTL. */
  cleanup(): void {
    const now = Date.now();
    let changed = false;

    for (const [chatId, entry] of this.sessions) {
      if (now - entry.lastActivity > this.ttlMs) {
        this.sessions.delete(chatId);
        changed = true;
      }
    }

    if (changed) {
      this.persist();
    }
  }

  private persist(): void {
    try {
      mkdirSync(STORE_DIR, { recursive: true });
      const data: Record<string, SessionEntry> = {};
      for (const [chatId, entry] of this.sessions) {
        data[String(chatId)] = entry;
      }
      writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to persist session store:", err);
    }
  }

  private load(): Map<number, SessionEntry> {
    const map = new Map<number, SessionEntry>();

    if (!existsSync(STORE_FILE)) {
      return map;
    }

    try {
      const raw = readFileSync(STORE_FILE, "utf-8");
      const data = JSON.parse(raw) as Record<string, SessionEntry>;

      for (const [key, entry] of Object.entries(data)) {
        const chatId = Number(key);
        if (
          Number.isInteger(chatId) &&
          entry &&
          typeof entry.claudeSessionId === "string" &&
          typeof entry.model === "string" &&
          typeof entry.workingDir === "string" &&
          typeof entry.lastActivity === "number"
        ) {
          map.set(chatId, entry);
        }
      }
    } catch {
      // Corrupt or unreadable file, start fresh
      console.warn("Could not load session store, starting fresh");
    }

    return map;
  }
}
