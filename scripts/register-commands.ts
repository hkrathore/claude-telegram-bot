/**
 * Standalone script to register all bot commands with BotFather.
 * Run: npx tsx scripts/register-commands.ts
 */
import { Bot } from "grammy";
import { loadConfig } from "../src/config.js";
import { ALL_COMMANDS } from "../src/commands/index.js";

async function main() {
  const config = loadConfig();
  const bot = new Bot(config.telegramToken);

  await bot.api.setMyCommands(ALL_COMMANDS);

  console.log(`Registered ${ALL_COMMANDS.length} commands:`);
  for (const cmd of ALL_COMMANDS) {
    console.log(`  /${cmd.command} - ${cmd.description}`);
  }
}

main().catch((err) => {
  console.error("Failed to register commands:", err);
  process.exit(1);
});
