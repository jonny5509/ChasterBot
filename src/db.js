import Database from "better-sqlite3";
import fs from "node:fs";

fs.mkdirSync("data", { recursive: true });
const db = new Database("data/chasterbot.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS profiles (
  discord_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  notification_channel_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  title TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

export function ensureProfile(user) {
  db.prepare("INSERT INTO profiles(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name")
    .run(user.id, user.username);
  return db.prepare("SELECT * FROM profiles WHERE discord_id=?").get(user.id);
}
export function addPoints(id, name, points) {
  ensureProfile({ id, username: name });
  db.prepare("UPDATE profiles SET points=MAX(0, points + ?) WHERE discord_id=?").run(points, id);
}
export function leaderboard(limit = 10) {
  return db.prepare("SELECT discord_id,display_name,points FROM profiles ORDER BY points DESC,display_name COLLATE NOCASE LIMIT ?").all(limit);
}
export function setNotificationChannel(guildId, channelId, actorId) {
  db.prepare("INSERT INTO guild_settings(guild_id,notification_channel_id) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET notification_channel_id=excluded.notification_channel_id,updated_at=CURRENT_TIMESTAMP")
    .run(guildId, channelId);
  audit(guildId, actorId, "notification_channel_set", channelId);
}
export function createChallenge(guildId, title, points, actorId) {
  const result = db.prepare("INSERT INTO challenges(guild_id,title,points,created_by) VALUES (?,?,?,?)").run(guildId, title, points, actorId);
  audit(guildId, actorId, "challenge_created", "#" + result.lastInsertRowid + ": " + title);
  return Number(result.lastInsertRowid);
}
export function audit(guildId, actorId, action, details = "") {
  db.prepare("INSERT INTO audit_logs(guild_id,actor_id,action,details) VALUES (?,?,?,?)").run(guildId ?? null, actorId, action, String(details).slice(0, 1000));
}
export function recentAudit(guildId, limit = 10) {
  return db.prepare("SELECT actor_id,action,details,created_at FROM audit_logs WHERE guild_id=? ORDER BY id DESC LIMIT ?").all(guildId, limit);
}
