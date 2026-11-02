import Database from "better-sqlite3";
import fs from "node:fs";
fs.mkdirSync("data", { recursive: true });
const db = new Database("data/chasterbot.sqlite");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS profiles(discord_id TEXT PRIMARY KEY,display_name TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS guild_settings(guild_id TEXT PRIMARY KEY,notification_channel_id TEXT,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT,actor_id TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS challenges(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,title TEXT NOT NULL,points INTEGER NOT NULL DEFAULT 10,active INTEGER NOT NULL DEFAULT 1,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS challenge_entries(challenge_id INTEGER NOT NULL,discord_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'joined',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(challenge_id,discord_id),FOREIGN KEY(challenge_id) REFERENCES challenges(id));
CREATE TABLE IF NOT EXISTS linked_accounts(discord_id TEXT PRIMARY KEY,chaster_user_id TEXT NOT NULL,username TEXT,encrypted_tokens TEXT NOT NULL,scopes TEXT NOT NULL DEFAULT '',expires_at INTEGER NOT NULL,linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY,discord_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notification_optins(guild_id TEXT NOT NULL,discord_id TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(guild_id,discord_id));
CREATE TABLE IF NOT EXISTS lock_snapshots(discord_id TEXT NOT NULL,lock_id TEXT NOT NULL,fingerprint TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(discord_id,lock_id));
CREATE TABLE IF NOT EXISTS reward_items(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('reward','punishment')),title TEXT NOT NULL,description TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);
export function ensureProfile(user){db.prepare("INSERT INTO profiles(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name").run(user.id,user.username);return db.prepare("SELECT * FROM profiles WHERE discord_id=?").get(user.id);}
export function addPoints(id,name,points){db.prepare("INSERT OR IGNORE INTO profiles(discord_id,display_name) VALUES (?,?)").run(id,name);db.prepare("UPDATE profiles SET points=MAX(0,points+?) WHERE discord_id=?").run(points,id);}
export function leaderboard(limit=10){return db.prepare("SELECT discord_id,display_name,points FROM profiles ORDER BY points DESC,display_name COLLATE NOCASE LIMIT ?").all(limit);}
export function setNotificationChannel(g,c,a){db.prepare("INSERT INTO guild_settings(guild_id,notification_channel_id) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET notification_channel_id=excluded.notification_channel_id,updated_at=CURRENT_TIMESTAMP").run(g,c);audit(g,a,"notification_channel_set",c);}
export function getGuildSettings(){return db.prepare("SELECT guild_id,notification_channel_id FROM guild_settings WHERE notification_channel_id IS NOT NULL").all();}
export function setNotificationOptIn(g,u,e){db.prepare("INSERT INTO notification_optins(guild_id,discord_id,enabled) VALUES (?,?,?) ON CONFLICT(guild_id,discord_id) DO UPDATE SET enabled=excluded.enabled").run(g,u,e?1:0);}
export function getOptedInUsers(g){return db.prepare("SELECT discord_id FROM notification_optins WHERE guild_id=? AND enabled=1").all(g).map(x=>x.discord_id);}
export function createChallenge(g,t,p,a){const r=db.prepare("INSERT INTO challenges(guild_id,title,points,created_by) VALUES (?,?,?,?)").run(g,t,p,a);audit(g,a,"challenge_created","#"+r.lastInsertRowid+": "+t);return Number(r.lastInsertRowid);}
export function joinChallenge(id,u){const c=db.prepare("SELECT id,active FROM challenges WHERE id=?").get(id);if(!c||!c.active)return false;db.prepare("INSERT OR IGNORE INTO challenge_entries(challenge_id,discord_id,status) VALUES (?,?,'joined')").run(id,u);return true;}
export function approveChallenge(id,u,a,g){const c=db.prepare("SELECT * FROM challenges WHERE id=? AND guild_id=? AND active=1").get(id,g);const e=db.prepare("SELECT * FROM challenge_entries WHERE challenge_id=? AND discord_id=?").get(id,u);if(!c||!e||e.status==="approved")return null;db.prepare("UPDATE challenge_entries SET status='approved' WHERE challenge_id=? AND discord_id=?").run(id,u);addPoints(u,"Discord member",c.points);audit(g,a,"challenge_approved","challenge #"+id+" for "+u+" ("+c.points+" points)");return c.points;}
export function addRewardItem(g,k,t,d,a){const r=db.prepare("INSERT INTO reward_items(guild_id,kind,title,description,created_by) VALUES (?,?,?,?,?)").run(g,k,t,d,a);audit(g,a,k+"_created",t);return Number(r.lastInsertRowid);}
export function listRewardItems(g,k){return db.prepare("SELECT id,title,description FROM reward_items WHERE guild_id=? AND kind=? ORDER BY id DESC LIMIT 20").all(g,k);}
export function saveOAuthState(s,u,e){db.prepare("DELETE FROM oauth_states WHERE expires_at<?").run(Date.now());db.prepare("INSERT INTO oauth_states(state,discord_id,expires_at) VALUES (?,?,?)").run(s,u,e);}
export function consumeOAuthState(s){const r=db.prepare("SELECT discord_id,expires_at FROM oauth_states WHERE state=?").get(s);db.prepare("DELETE FROM oauth_states WHERE state=?").run(s);return r&&r.expires_at>Date.now()?r.discord_id:null;}
export function saveLinkedAccount(u,c,n,t,s,e){db.prepare("INSERT INTO linked_accounts(discord_id,chaster_user_id,username,encrypted_tokens,scopes,expires_at) VALUES (?,?,?,?,?,?) ON CONFLICT(discord_id) DO UPDATE SET chaster_user_id=excluded.chaster_user_id,username=excluded.username,encrypted_tokens=excluded.encrypted_tokens,scopes=excluded.scopes,expires_at=excluded.expires_at,linked_at=CURRENT_TIMESTAMP").run(u,c,n??null,t,s??"",e);}
export function getLinkedAccount(u){return db.prepare("SELECT * FROM linked_accounts WHERE discord_id=?").get(u)??null;}
export function getAllLinkedAccounts(){return db.prepare("SELECT * FROM linked_accounts").all();}
export function deleteLinkedAccount(u){db.prepare("DELETE FROM linked_accounts WHERE discord_id=?").run(u);db.prepare("DELETE FROM lock_snapshots WHERE discord_id=?").run(u);}
export function getLockSnapshot(u,l){return db.prepare("SELECT fingerprint FROM lock_snapshots WHERE discord_id=? AND lock_id=?").get(u,l)?.fingerprint??null;}
export function setLockSnapshot(u,l,f){db.prepare("INSERT INTO lock_snapshots(discord_id,lock_id,fingerprint) VALUES (?,?,?) ON CONFLICT(discord_id,lock_id) DO UPDATE SET fingerprint=excluded.fingerprint,updated_at=CURRENT_TIMESTAMP").run(u,l,f);}
export function audit(g,u,a,d=""){db.prepare("INSERT INTO audit_logs(guild_id,actor_id,action,details) VALUES (?,?,?,?)").run(g??null,u,a,String(d).slice(0,1000));}
export function recentAudit(g,l=10){return db.prepare("SELECT actor_id,action,details,created_at FROM audit_logs WHERE guild_id=? ORDER BY id DESC LIMIT ?").all(g,l);}
