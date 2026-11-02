import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleCommand } from "./commands.js";

if (!process.env.DISCORD_TOKEN) throw new Error("Missing DISCORD_TOKEN in .env");
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => console.log("Logged in as " + c.user.tag));
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error("Command failed:", error?.message ?? "unknown error");
    const payload = { content: "The command failed. Check the bot logs; secrets are never shown here.", ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});
client.login(process.env.DISCORD_TOKEN);
