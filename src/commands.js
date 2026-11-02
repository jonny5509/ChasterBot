import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { ensureProfile, leaderboard, createChallenge, setNotificationChannel, recentAudit } from "./db.js";

export const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
  new SlashCommandBuilder().setName("profile").setDescription("Show your profile and points."),
  new SlashCommandBuilder().setName("leaderboard").setDescription("Show the community leaderboard."),
  new SlashCommandBuilder().setName("challenge").setDescription("Create a community challenge.")
    .addStringOption(o => o.setName("title").setDescription("Challenge title").setRequired(true).setMaxLength(100))
    .addIntegerOption(o => o.setName("points").setDescription("Points from 1 to 100").setMinValue(1).setMaxValue(100)),
  new SlashCommandBuilder().setName("notify-channel").setDescription("Set the notification channel.")
    .addChannelOption(o => o.setName("channel").setDescription("Text channel").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName("audit").setDescription("Show recent admin actions.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName("lock-status").setDescription("Show your linked Chaster lock status.")
];

export async function handleCommand(i) {
  const name = i.commandName;
  if (name === "help") return i.reply({ ephemeral: true, content: "**ChasterBot Enhanced**\n/profile · /leaderboard · /challenge\n/notify-channel · /audit · /lock-status\n\nOAuth and lock-changing actions are staged for the next integration milestone." });
  if (name === "profile") {
    const p = ensureProfile(i.user);
    return i.reply({ ephemeral: true, content: "**" + p.display_name + "**\nPoints: **" + p.points + "**" });
  }
  if (name === "leaderboard") {
    const rows = leaderboard(10);
    return i.reply(rows.length ? "**Community leaderboard**\n" + rows.map((r, n) => (n + 1) + ". **" + r.display_name + "** — " + r.points + " pts").join("\n") : "No profiles yet. Run /profile to join.");
  }
  if (name === "challenge") {
    const title = i.options.getString("title", true);
    const points = i.options.getInteger("points") ?? 10;
    const id = createChallenge(i.guildId, title, points, i.user.id);
    return i.reply("Challenge **#" + id + "** created: **" + title + "** (" + points + " points).");
  }
  if (name === "notify-channel") {
    const channel = i.options.getChannel("channel", true);
    if (!channel.isTextBased()) return i.reply({ ephemeral: true, content: "Choose a text channel." });
    setNotificationChannel(i.guildId, channel.id, i.user.id);
    return i.reply({ ephemeral: true, content: "Notification destination saved: " + channel.toString() });
  }
  if (name === "audit") {
    const rows = recentAudit(i.guildId, 10);
    return i.reply({ ephemeral: true, content: rows.length ? rows.map(r => "• <t:" + Math.floor(new Date(r.created_at + " UTC").getTime() / 1000) + ":R> <@" + r.actor_id + "> — " + r.action + ": " + r.details).join("\n") : "No audit entries yet." });
  }
  if (name === "lock-status") {
    return i.reply({ ephemeral: true, content: "Chaster OAuth linking is not configured yet. No live lock data is available." });
  }
}
