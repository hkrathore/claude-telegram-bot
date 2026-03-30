import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { loadConfig } from "./config.js";
import { createBot } from "./bot.js";
import { ALL_COMMANDS } from "./commands/index.js";

async function main() {
  const config = loadConfig();
  const bot = createBot(config);

  // Register commands with BotFather for autocomplete
  await bot.api.setMyCommands(ALL_COMMANDS);
  console.log(`Registered ${ALL_COMMANDS.length} commands with BotFather`);

  if (config.webhook) {
    // Webhook mode
    const { url, port, secret } = config.webhook;
    const server = createServer(webhookCallback(bot, "http", { secretToken: secret }));
    server.listen(port, () => {
      console.log(`Webhook server listening on port ${port}`);
    });
    await bot.api.setWebhook(url, { secret_token: secret });
    console.log(`Webhook set to ${url}`);
  } else {
    // Polling mode
    console.log("Starting bot in polling mode...");
    await bot.start({
      onStart: (info) => {
        console.log(`Bot @${info.username} started (polling)`);
      },
    });
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
