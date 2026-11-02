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
CREATE TABLE IF NOT EXISTS chaster_link_health(discord_id TEXT PRIMARY KEY,status TEXT NOT NULL,reason TEXT NOT NULL DEFAULT '',last_notified_at INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY,discord_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notification_optins(guild_id TEXT NOT NULL,discord_id TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(guild_id,discord_id));
CREATE TABLE IF NOT EXISTS lock_snapshots(discord_id TEXT NOT NULL,lock_id TEXT NOT NULL,fingerprint TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(discord_id,lock_id));
CREATE TABLE IF NOT EXISTS reward_items(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('reward','punishment')),title TEXT NOT NULL,description TEXT NOT NULL,created_by TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS session_invites(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,inviter_id TEXT NOT NULL,invitee_id TEXT NOT NULL,expires_at INTEGER NOT NULL);\nCREATE TABLE IF NOT EXISTS discord_notification_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,dedupe_key TEXT NOT NULL UNIQUE,destination_type TEXT NOT NULL CHECK(destination_type IN ('user','channel')),target_id TEXT NOT NULL,content TEXT NOT NULL,allowed_mentions TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,sent_at INTEGER);\nCREATE INDEX IF NOT EXISTS idx_notification_queue_due ON discord_notification_queue(status,next_attempt_at,id);
`);
for (const sql of ["ALTER TABLE guild_settings ADD COLUMN wearer_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN keyholder_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN session_channel_id TEXT"]) { try { db.exec(sql); } catch (e) { if (!String(e.message).includes("duplicate column")) throw e; } }
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
export function deleteLinkedAccount(u){db.prepare("DELETE FROM linked_accounts WHERE discord_id=?").run(u);db.prepare("DELETE FROM lock_snapshots WHERE discord_id=?").run(u);db.prepare("DELETE FROM chaster_link_health WHERE discord_id=?").run(u);}
export function getLockSnapshot(u,l){return db.prepare("SELECT fingerprint FROM lock_snapshots WHERE discord_id=? AND lock_id=?").get(u,l)?.fingerprint??null;}
export function setLockSnapshot(u,l,f){db.prepare("INSERT INTO lock_snapshots(discord_id,lock_id,fingerprint) VALUES (?,?,?) ON CONFLICT(discord_id,lock_id) DO UPDATE SET fingerprint=excluded.fingerprint,updated_at=CURRENT_TIMESTAMP").run(u,l,f);}
export function audit(g,u,a,d=""){db.prepare("INSERT INTO audit_logs(guild_id,actor_id,action,details) VALUES (?,?,?,?)").run(g??null,u,a,String(d).slice(0,1000));}
export function recentAudit(g,l=10){return db.prepare("SELECT actor_id,action,details,created_at FROM audit_logs WHERE guild_id=? ORDER BY id DESC LIMIT ?").all(g,l);}

export function setGuildRoles(g,w,k,a){db.prepare("INSERT INTO guild_settings(guild_id,wearer_role_id,keyholder_role_id) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET wearer_role_id=excluded.wearer_role_id,keyholder_role_id=excluded.keyholder_role_id,updated_at=CURRENT_TIMESTAMP").run(g,w??null,k??null);audit(g,a,"role_configured","wearer="+(w||"none")+", keyholder="+(k||"none"));}
export function getRoleSettings(){return db.prepare("SELECT guild_id,wearer_role_id,keyholder_role_id FROM guild_settings WHERE wearer_role_id IS NOT NULL OR keyholder_role_id IS NOT NULL").all();}
export function setSessionChannel(g,c,a){db.prepare("INSERT INTO guild_settings(guild_id,session_channel_id) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET session_channel_id=excluded.session_channel_id,updated_at=CURRENT_TIMESTAMP").run(g,c);audit(g,a,"session_channel_configured",c);}
export function getSessionChannel(g){return db.prepare("SELECT session_channel_id FROM guild_settings WHERE guild_id=?").get(g)?.session_channel_id??null;}
export function createSessionInvite(id,g,c,from,to,expires){db.prepare("INSERT INTO session_invites(id,guild_id,channel_id,inviter_id,invitee_id,expires_at) VALUES (?,?,?,?,?,?)").run(id,g,c,from,to,expires);}
export function consumeSessionInvite(id){const x=db.prepare("SELECT * FROM session_invites WHERE id=?").get(id);db.prepare("DELETE FROM session_invites WHERE id=?").run(id);return x&&x.expires_at>Date.now()?x:null;}

export function markChasterLinkNeedsReauth(id,reason="authorization rejected"){
  const previous=db.prepare("SELECT status,last_notified_at FROM chaster_link_health WHERE discord_id=?").get(id);
  const shouldNotify=!previous||previous.status!=="needs_reauth"||!previous.last_notified_at||Date.now()-previous.last_notified_at>86400000;
  db.prepare("INSERT INTO chaster_link_health(discord_id,status,reason,last_notified_at) VALUES (?,'needs_reauth',?,?) ON CONFLICT(discord_id) DO UPDATE SET status='needs_reauth',reason=excluded.reason,last_notified_at=CASE WHEN ? THEN excluded.last_notified_at ELSE chaster_link_health.last_notified_at END,updated_at=CURRENT_TIMESTAMP").run(id,String(reason).slice(0,120),shouldNotify?Date.now():null,shouldNotify?1:0);
  return shouldNotify;
}
export function clearChasterLinkHealth(id){db.prepare("DELETE FROM chaster_link_health WHERE discord_id=?").run(id);}
export function getChasterLinkHealth(id){return db.prepare("SELECT status,reason,updated_at FROM chaster_link_health WHERE discord_id=?").get(id)??null;}

export function enqueueDiscordNotification({dedupeKey,destinationType,targetId,content,allowedMentions={}}){
  if(!dedupeKey||!["user","channel"].includes(destinationType)||!targetId||!content)return false;
  const r=db.prepare("INSERT OR IGNORE INTO discord_notification_queue(dedupe_key,destination_type,target_id,content,allowed_mentions,created_at) VALUES (?,?,?,?,?,?)").run(String(dedupeKey),destinationType,String(targetId),String(content).slice(0,2000),JSON.stringify(allowedMentions),Date.now());
  return r.changes===1;
}
export function getDueDiscordNotifications(limit=20,now=Date.now()){
  return db.prepare("SELECT * FROM discord_notification_queue WHERE status='pending' AND next_attempt_at<=? ORDER BY id LIMIT ?").all(now,Math.max(1,Math.min(100,limit)));
}
export function markDiscordNotificationSent(id){
  db.prepare("UPDATE discord_notification_queue SET status='sent',sent_at=?,last_error='' WHERE id=? AND status='pending'").run(Date.now(),id);
}
export function markDiscordNotificationFailed(id,error,{retryAt=null,maxAttempts=5}={}){
  const row=db.prepare("SELECT attempts FROM discord_notification_queue WHERE id=? AND status='pending'").get(id);
  if(!row)return;
  const attempts=row.attempts+1,failed=retryAt===null||attempts>=maxAttempts;
  db.prepare("UPDATE discord_notification_queue SET attempts=?,status=?,next_attempt_at=?,last_error=? WHERE id=? AND status='pending'").run(attempts,failed?'failed':'pending',retryAt??0,String(error||"Delivery failed").slice(0,500),id);
}
export function getDiscordNotificationQueueStats(){
  return db.prepare("SELECT status,COUNT(*) AS count FROM discord_notification_queue GROUP BY status").all().reduce((a,x)=>(a[x.status]=x.count,a),{pending:0,sent:0,failed:0});
}

export function pruneDiscordNotificationQueue(now=Date.now()){
  const sentBefore=now-30*86400000,failedBefore=now-90*86400000;
  return db.prepare("DELETE FROM discord_notification_queue WHERE (status='sent' AND sent_at<?) OR (status='failed' AND created_at<?)").run(sentBefore,failedBefore).changes;
}
