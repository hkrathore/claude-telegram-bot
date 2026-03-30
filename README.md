# Claude Telegram Bot

A Telegram bot that bridges to [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI. Chat with Claude, run slash commands, and execute skills -- all from Telegram.

Works in 1:1 chats and group conversations.

## What it does

- **Chat with Claude** -- send any message, get Claude's response
- **All Claude Code skills** available as Telegram commands (`/commit`, `/simplify`, `/code_review`, etc.)
- **Session continuity** -- conversations persist across messages (Claude remembers context)
- **Per-chat settings** -- set model and working directory per chat
- **Group support** -- add the bot to a group, interact via commands or @mentions
- **Live progress updates** -- see what Claude is doing in real time ("Using Bash...", "Using Read...")
- **Cancel support** -- `/cancel` aborts a running operation
- **Rate limiting** -- one active invocation per chat, no accidental spam
- **Auto-discover custom skills** -- picks up skills from `~/.claude/skills/` automatically
- **Long response handling** -- auto-chunks responses that exceed Telegram's 4096 char limit
- **Markdown formatting** -- Claude's markdown output converted to Telegram-compatible HTML

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated
- A Telegram bot token from [@BotFather](https://t.me/botfather)

## Setup

1. **Clone the repo**

```bash
git clone https://github.com/hkrathore/claude-telegram-bot.git
cd claude-telegram-bot
npm install
```

2. **Create a Telegram bot**

Open [@BotFather](https://t.me/botfather) on Telegram, send `/newbot`, follow the prompts, and copy the token.

3. **Get your Telegram user ID**

Send a message to [@userinfobot](https://t.me/userinfobot) on Telegram. It will reply with your numeric user ID.

4. **Configure**

```bash
cp .env.example .env
```

Edit `.env`:

```
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
ALLOWED_USER_IDS=12345678
```

5. **Start**

```bash
npm start
```

The bot will start polling for messages. Send `/start` to your bot on Telegram.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | -- | Bot token from BotFather |
| `ALLOWED_USER_IDS` | Yes | -- | Comma-separated Telegram user IDs |
| `CLAUDE_MODEL` | No | `sonnet` | Default model (`sonnet`, `opus`, `haiku`) |
| `DEFAULT_WORKING_DIR` | No | Current dir | Working directory for Claude operations |
| `CLAUDE_BINARY` | No | `claude` | Path to Claude CLI binary |
| `MAX_BUDGET_USD` | No | -- | Cost cap per invocation |
| `SESSION_TTL_HOURS` | No | `24` | Session expiry time |
| `WEBHOOK_URL` | No | -- | Set to enable webhook mode (polling by default) |
| `WEBHOOK_PORT` | No | `8443` | Port for webhook server |
| `WEBHOOK_SECRET` | No | Auto-generated | Secret for webhook verification |

## Commands

### Bot commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | List all commands |
| `/model <name>` | Switch model (sonnet/opus/haiku) |
| `/workdir <path>` | Set working directory |
| `/session new` | Start fresh conversation |
| `/session` | Show current session info |
| `/cancel` | Cancel running operation |

### Claude Code skills

| Command | Description |
|---------|-------------|
| `/commit` | Create a git commit |
| `/commit_push_pr` | Commit, push, and create PR |
| `/simplify` | Review and simplify code |
| `/code_review` | Review code changes |
| `/feature_dev` | Develop a new feature |
| `/ralph_loop` | Iterative development loop |
| `/cancel_ralph` | Cancel active Ralph loop |
| `/clean_gone` | Clean up deleted branches |

> Telegram commands don't support hyphens, so `commit-push-pr` becomes `commit_push_pr`. The bot maps them back automatically.

### Custom skills

Any skills you've created in `~/.claude/skills/` are automatically discovered at startup and registered as Telegram commands. They appear in `/help` under "Custom Skills" and get Telegram autocomplete.

## Architecture

```
Telegram → grammY bot → spawn claude -p "<prompt>" --output-format stream-json → parse events → format → send back
```

```
src/
├── index.ts              # Entry point (polling or webhook)
├── bot.ts                # Bot instance + middleware chain
├── config.ts             # Environment config loader
├── claude/
│   ├── cli.ts            # Spawns Claude CLI, parses stream-json
│   ├── session-store.ts  # Chat ID → Claude session mapping
│   └── types.ts          # CLI output types
├── commands/
│   ├── index.ts          # Command registry
│   ├── chat.ts           # Freeform message handler
│   ├── skills.ts         # Skill command passthrough
│   ├── start.ts          # /start
│   ├── help.ts           # /help
│   ├── model.ts          # /model
│   ├── workdir.ts        # /workdir
│   └── session.ts        # /session
├── middleware/
│   ├── auth.ts           # User allowlist
│   ├── typing.ts         # Typing indicator refresh
│   └── error.ts          # Error boundary
└── util/
    ├── format.ts         # Markdown → Telegram HTML
    ├── chunker.ts        # Message splitting (4096 char limit)
    └── reply.ts          # Send with HTML fallback
```

### How it works

1. Message arrives from Telegram
2. Auth middleware checks user ID against allowlist
3. Command router dispatches to the right handler
4. Handler spawns `claude -p "<prompt>" --output-format stream-json`
5. CLI output is parsed line-by-line as JSON events
6. Response is converted from Markdown to Telegram HTML
7. Long responses are chunked at paragraph/sentence boundaries
8. Typing indicator refreshes every 4s while Claude works

### Session continuity

Each chat gets its own Claude session. The bot stores session IDs in `~/.claude-telegram-bot/sessions.json` and passes `--resume <sessionId>` on subsequent messages so Claude retains conversation context.

## Deployment

### Polling (development)

Default mode. No public URL needed.

```bash
npm start
```

### Webhook (production)

Set `WEBHOOK_URL` in `.env` to your public HTTPS endpoint:

```
WEBHOOK_URL=https://your-server.com/webhook
WEBHOOK_PORT=8443
```

### Docker

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["npm", "start"]
```

### Process manager

```bash
# PM2
pm2 start npm --name claude-telegram -- start

# systemd, etc.
```

## Security

- **Allowlist-only**: Only Telegram user IDs in `ALLOWED_USER_IDS` can interact
- **Budget cap**: Set `MAX_BUDGET_USD` to limit per-invocation cost
- **Tool permissions**: Configure `ALLOWED_TOOLS` to restrict what Claude can do
- **No secrets in code**: All config via environment variables

## License

MIT
