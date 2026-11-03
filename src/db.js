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
CREATE TABLE IF NOT EXISTS session_invites(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,channel_id TEXT NOT NULL,inviter_id TEXT NOT NULL,invitee_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS private_sessions(id TEXT PRIMARY KEY,guild_id TEXT NOT NULL,thread_id TEXT NOT NULL UNIQUE,inviter_id TEXT NOT NULL,invitee_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS session_activity(id INTEGER PRIMARY KEY AUTOINCREMENT,guild_id TEXT NOT NULL,invite_id TEXT,thread_id TEXT,actor_id TEXT NOT NULL,other_id TEXT NOT NULL,event TEXT NOT NULL CHECK(event IN ('invited','accepted','declined','cancelled','created','closed')),created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS discord_notification_queue(id INTEGER PRIMARY KEY AUTOINCREMENT,dedupe_key TEXT NOT NULL UNIQUE,destination_type TEXT NOT NULL CHECK(destination_type IN ('user','channel')),target_id TEXT NOT NULL,content TEXT NOT NULL,allowed_mentions TEXT NOT NULL DEFAULT '{}',status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed')),attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL,sent_at INTEGER);\nCREATE INDEX IF NOT EXISTS idx_notification_queue_due ON discord_notification_queue(status,next_attempt_at,id);
CREATE TABLE IF NOT EXISTS notification_admin_alerts(guild_id TEXT PRIMARY KEY,last_alert_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS role_sync_health(id INTEGER PRIMARY KEY CHECK(id=1),last_started_at INTEGER,last_completed_at INTEGER,last_success_at INTEGER,accounts_total INTEGER NOT NULL DEFAULT 0,accounts_succeeded INTEGER NOT NULL DEFAULT 0,accounts_failed INTEGER NOT NULL DEFAULT 0,last_error TEXT NOT NULL DEFAULT '',interval_minutes INTEGER NOT NULL DEFAULT 10);
CREATE TABLE IF NOT EXISTS notification_channel_pauses(guild_id TEXT PRIMARY KEY,channel_id TEXT NOT NULL,reason TEXT NOT NULL,paused_at INTEGER NOT NULL);
`);
for (const sql of ["ALTER TABLE guild_settings ADD COLUMN wearer_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN keyholder_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN session_channel_id TEXT","ALTER TABLE guild_settings ADD COLUMN notification_retention_days INTEGER NOT NULL DEFAULT 30","ALTER TABLE guild_settings ADD COLUMN role_sync_enabled INTEGER NOT NULL DEFAULT 1","ALTER TABLE guild_settings ADD COLUMN role_remove_inactive INTEGER NOT NULL DEFAULT 1","ALTER TABLE guild_settings ADD COLUMN locked_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN active_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN minimum_locked_role_id TEXT","ALTER TABLE guild_settings ADD COLUMN minimum_locked_hours INTEGER NOT NULL DEFAULT 0"]) { try { db.exec(sql); } catch (e) { if (!String(e.message).includes("duplicate column")) throw e; } }
export function ensureProfile(user){db.prepare("INSERT INTO profiles(discord_id,display_name) VALUES (?,?) ON CONFLICT(discord_id) DO UPDATE SET display_name=excluded.display_name").run(user.id,user.username);return db.prepare("SELECT * FROM profiles WHERE discord_id=?").get(user.id);}
export function addPoints(id,name,points){db.prepare("INSERT OR IGNORE INTO profiles(discord_id,display_name) VALUES (?,?)").run(id,name);db.prepare("UPDATE profiles SET points=MAX(0,points+?) WHERE discord_id=?").run(points,id);}
export function leaderboard(limit=10){return db.prepare("SELECT discord_id,display_name,points FROM profiles ORDER BY points DESC,display_name COLLATE NOCASE LIMIT ?").all(limit);}
export function setNotificationChannel(g,c,a){db.prepare("INSERT INTO guild_settings(guild_id,notification_channel_id) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET notification_channel_id=excluded.notification_channel_id,updated_at=CURRENT_TIMESTAMP").run(g,c);db.prepare("DELETE FROM notification_channel_pauses WHERE guild_id=?").run(String(g));audit(g,a,"notification_channel_set",c);}
export function pauseNotificationChannel(guildId,channelId,reason="delivery failed"){db.prepare("INSERT INTO notification_channel_pauses(guild_id,channel_id,reason,paused_at) VALUES (?,?,?,?) ON CONFLICT(guild_id) DO UPDATE SET channel_id=excluded.channel_id,reason=excluded.reason,paused_at=excluded.paused_at").run(String(guildId),String(channelId),String(reason).slice(0,120),Date.now());}
export function getNotificationChannelPause(guildId){return db.prepare("SELECT channel_id,reason,paused_at FROM notification_channel_pauses WHERE guild_id=?").get(String(guildId))??null;}
export function isNotificationChannelPaused(guildId,channelId){const row=getNotificationChannelPause(guildId);return Boolean(row&&row.channel_id===String(channelId));}
export function getGuildSettings(){return db.prepare("SELECT guild_id,notification_channel_id FROM guild_settings WHERE notification_channel_id IS NOT NULL").all();}
export function setNotificationOptIn(g,u,e){db.prepare("INSERT INTO notification_optins(guild_id,discord_id,enabled) VALUES (?,?,?) ON CONFLICT(guild_id,discord_id) DO UPDATE SET enabled=excluded.enabled").run(g,u,e?1:0);}
export function getOptedInUsers(g){return db.prepare("SELECT discord_id FROM notification_optins WHERE guild_id=? AND enabled=1").all(g).map(x=>x.discord_id);}
export function createChallenge(g,t,p,a){const r=db.prepare("INSERT INTO challenges(guild_id,title,points,created_by) VALUES (?,?,?,?)").run(g,t,p,a);audit(g,a,"challenge_created","#"+r.lastInsertRowid+": "+t);return Number(r.lastInsertRowid);}
export function joinChallenge(id,u,g){const c=db.prepare("SELECT id,active FROM challenges WHERE id=? AND guild_id=?").get(id,g);if(!c||!c.active)return false;db.prepare("INSERT OR IGNORE INTO challenge_entries(challenge_id,discord_id,status) VALUES (?,?,'joined')").run(id,u);return true;}
export function listChallenges(g){return db.prepare("SELECT c.id,c.title,c.points,c.created_at,(SELECT COUNT(*) FROM challenge_entries e WHERE e.challenge_id=c.id) AS participants FROM challenges c WHERE c.guild_id=? AND c.active=1 ORDER BY c.id DESC LIMIT 12").all(g);}
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
export function recentAudit(g,l=10,filters={}){
  const where=["guild_id=?"],params=[String(g)];
  const action=String(filters.action||"").trim().slice(0,80);
  const actor=String(filters.actorId||"").trim();
  const search=String(filters.search||"").trim().slice(0,120);
  const days=Number(filters.days)||0;
  if(action){where.push("action LIKE ?");params.push("%"+action+"%");}
  if(actor){where.push("actor_id=?");params.push(actor);}
  if(search){where.push("(action LIKE ? OR details LIKE ?)");params.push("%"+search+"%","%"+search+"%");}
  if([1,7,30,90].includes(days)){where.push("created_at>=datetime('now', ?)");params.push("-"+days+" days");}
  const limit=Math.max(1,Math.min(500,Number(l)||10));
  return db.prepare("SELECT id,actor_id,action,details,created_at FROM audit_logs WHERE "+where.join(" AND ")+" ORDER BY id DESC LIMIT ?").all(...params,limit);
}

export function setGuildRoles(g,w,k,a){db.prepare("INSERT INTO guild_settings(guild_id,wearer_role_id,keyholder_role_id) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET wearer_role_id=excluded.wearer_role_id,keyholder_role_id=excluded.keyholder_role_id,updated_at=CURRENT_TIMESTAMP").run(g,w??null,k??null);audit(g,a,"role_configured","wearer="+(w||"none")+", keyholder="+(k||"none"));}
export function recordRoleSyncStarted(total,intervalMinutes,now=Date.now()){
  db.prepare("INSERT INTO role_sync_health(id,last_started_at,accounts_total,accounts_succeeded,accounts_failed,last_error,interval_minutes) VALUES (1,?,?,0,0,'',?) ON CONFLICT(id) DO UPDATE SET last_started_at=excluded.last_started_at,accounts_total=excluded.accounts_total,accounts_succeeded=0,accounts_failed=0,last_error='',interval_minutes=excluded.interval_minutes").run(now,Math.max(0,Number(total)||0),intervalMinutes);
}
export function recordRoleSyncCompleted({succeeded,failed,lastError="",now=Date.now()}){
  db.prepare("UPDATE role_sync_health SET last_completed_at=?,last_success_at=CASE WHEN ?=0 THEN ? ELSE last_success_at END,accounts_succeeded=?,accounts_failed=?,last_error=? WHERE id=1").run(now,failed,now,succeeded,failed,String(lastError).slice(0,500));
}
export function getRoleSyncHealth(){
  return db.prepare("SELECT last_started_at,last_completed_at,last_success_at,accounts_total,accounts_succeeded,accounts_failed,last_error,interval_minutes FROM role_sync_health WHERE id=1").get()??null;
}
export function getRoleSettings(){return db.prepare("SELECT guild_id,wearer_role_id,keyholder_role_id,role_sync_enabled,role_remove_inactive,locked_role_id,active_role_id,minimum_locked_role_id,minimum_locked_hours FROM guild_settings WHERE wearer_role_id IS NOT NULL OR keyholder_role_id IS NOT NULL OR locked_role_id IS NOT NULL OR active_role_id IS NOT NULL OR minimum_locked_role_id IS NOT NULL").all();}
export function setGuildStatusRoles(guildId,{lockedRoleId,activeRoleId},actorId){
  db.prepare("INSERT INTO guild_settings(guild_id,locked_role_id,active_role_id) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET locked_role_id=excluded.locked_role_id,active_role_id=excluded.active_role_id,updated_at=CURRENT_TIMESTAMP").run(String(guildId),lockedRoleId??null,activeRoleId??null);
  audit(guildId,actorId,"role_status_configured","locked="+(lockedRoleId||"none")+", active="+(activeRoleId||"none"));
}
export function setMinimumLockedRole(guildId,{roleId,hours},actorId){
  db.prepare("INSERT INTO guild_settings(guild_id,minimum_locked_role_id,minimum_locked_hours) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET minimum_locked_role_id=excluded.minimum_locked_role_id,minimum_locked_hours=excluded.minimum_locked_hours,updated_at=CURRENT_TIMESTAMP").run(String(guildId),roleId??null,Number(hours)||0);
  audit(guildId,actorId,"minimum_locked_role_configured","role="+(roleId||"none")+", hours="+(Number(hours)||0));
}
export function setGuildRoleAutomation(guildId,{enabled=true,removeInactive=true},actorId){
  db.prepare("INSERT INTO guild_settings(guild_id,role_sync_enabled,role_remove_inactive) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET role_sync_enabled=excluded.role_sync_enabled,role_remove_inactive=excluded.role_remove_inactive,updated_at=CURRENT_TIMESTAMP").run(String(guildId),enabled?1:0,removeInactive?1:0);
  audit(guildId,actorId,"role_automation_configured","sync="+Boolean(enabled)+", remove_inactive="+Boolean(removeInactive));
}
export function setSessionChannel(g,c,a){db.prepare("INSERT INTO guild_settings(guild_id,session_channel_id) VALUES (?,?,?) ON CONFLICT(guild_id) DO UPDATE SET session_channel_id=excluded.session_channel_id,updated_at=CURRENT_TIMESTAMP").run(g,c);audit(g,a,"session_channel_configured",c);}
export function getSessionChannel(g){return db.prepare("SELECT session_channel_id FROM guild_settings WHERE guild_id=?").get(g)?.session_channel_id??null;}
export function recordSessionActivity(guildId,actorId,otherId,event,{inviteId=null,threadId=null}={}){db.prepare("INSERT INTO session_activity(guild_id,invite_id,thread_id,actor_id,other_id,event,created_at) VALUES (?,?,?,?,?,?,?)").run(String(guildId),inviteId?String(inviteId):null,threadId?String(threadId):null,String(actorId),String(otherId),event,Date.now());}
export function getMemberSessionActivity(guildId,discordId,limit=12){return db.prepare("SELECT event,actor_id,other_id,thread_id,created_at FROM session_activity WHERE guild_id=? AND (actor_id=? OR other_id=?) ORDER BY created_at DESC,id DESC LIMIT ?").all(String(guildId),String(discordId),String(discordId),Math.max(1,Math.min(25,Number(limit)||12)));}
export function createSessionInvite(id,g,c,from,to,expires){db.prepare("INSERT INTO session_invites(id,guild_id,channel_id,inviter_id,invitee_id,expires_at) VALUES (?,?,?,?,?,?)").run(id,g,c,from,to,expires);}
export function consumeSessionInvite(id,inviteeId){const now=Date.now();const x=db.prepare("SELECT * FROM session_invites WHERE id=? AND invitee_id=? AND expires_at>?").get(String(id),String(inviteeId),now);if(!x)return null;const result=db.prepare("DELETE FROM session_invites WHERE id=? AND invitee_id=? AND expires_at>?").run(String(id),String(inviteeId),now);return result.changes?x:null;}
export function deleteSessionInvite(id,guildId,discordId){return db.prepare("DELETE FROM session_invites WHERE id=? AND guild_id=? AND (inviter_id=? OR invitee_id=?)").run(String(id),String(guildId),String(discordId),String(discordId)).changes>0;}
export function recordPrivateSession(id,guildId,threadId,inviterId,inviteeId){
  db.prepare("INSERT INTO private_sessions(id,guild_id,thread_id,inviter_id,invitee_id,created_at) VALUES (?,?,?,?,?,?)").run(String(id),String(guildId),String(threadId),String(inviterId),String(inviteeId),Date.now());
}
export function deletePrivateSession(guildId,threadId,discordId){return db.prepare("DELETE FROM private_sessions WHERE guild_id=? AND thread_id=? AND (inviter_id=? OR invitee_id=?)").run(String(guildId),String(threadId),String(discordId),String(discordId)).changes>0;}
export function getMemberSessionDashboard(guildId,discordId){
  const id=String(discordId),guild=String(guildId);
  const sessions=db.prepare("SELECT thread_id,inviter_id,invitee_id,created_at FROM private_sessions WHERE guild_id=? AND (inviter_id=? OR invitee_id=?) ORDER BY created_at DESC LIMIT 5").all(guild,id,id);
  const invites=db.prepare("SELECT id,inviter_id,invitee_id,expires_at FROM session_invites WHERE guild_id=? AND expires_at>? AND (inviter_id=? OR invitee_id=?) ORDER BY expires_at LIMIT 5").all(guild,Date.now(),id,id);
  return {sessions,invites};
}
export function getGuildRoleSettings(guildId){
  return db.prepare("SELECT wearer_role_id,keyholder_role_id,role_sync_enabled,role_remove_inactive,locked_role_id,active_role_id,minimum_locked_role_id,minimum_locked_hours FROM guild_settings WHERE guild_id=?").get(String(guildId))??{wearer_role_id:null,keyholder_role_id:null,role_sync_enabled:1,role_remove_inactive:1,locked_role_id:null,active_role_id:null,minimum_locked_role_id:null,minimum_locked_hours:0};
}

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
export function getDiscordNotificationQueueStats(guildId){
  const rows=db.prepare("SELECT q.status,COUNT(*) AS count FROM discord_notification_queue q JOIN guild_settings g ON g.notification_channel_id=q.target_id WHERE q.destination_type='channel' AND g.guild_id=? GROUP BY q.status").all(String(guildId));
  return rows.reduce((a,x)=>(a[x.status]=x.count,a),{pending:0,sent:0,failed:0});
}

export function getNotificationRetentionDays(guildId){
  return db.prepare("SELECT notification_retention_days FROM guild_settings WHERE guild_id=?").get(String(guildId))?.notification_retention_days??30;
}
export function setNotificationRetentionDays(guildId,days,actorId){
  const value=Number(days);
  if(![7,30,90].includes(value))throw new RangeError("Notification retention must be 7, 30, or 90 days");
  db.prepare("INSERT INTO guild_settings(guild_id,notification_retention_days) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET notification_retention_days=excluded.notification_retention_days,updated_at=CURRENT_TIMESTAMP").run(String(guildId),value);
  audit(guildId,actorId,"notification_retention_updated",value+" days");
  return value;
}
export function pruneDiscordNotificationQueue(now=Date.now()){
  const defaultSentBefore=now-30*86400000,defaultFailedBefore=now-90*86400000;
  const channelResult=db.prepare("DELETE FROM discord_notification_queue WHERE destination_type='channel' AND ((status='sent' AND sent_at<(?-COALESCE((SELECT notification_retention_days FROM guild_settings WHERE notification_channel_id=discord_notification_queue.target_id),30)*86400000)) OR (status='failed' AND created_at<(?-COALESCE((SELECT notification_retention_days FROM guild_settings WHERE notification_channel_id=discord_notification_queue.target_id),30)*86400000)))").run(now,now);
  const userResult=db.prepare("DELETE FROM discord_notification_queue WHERE destination_type='user' AND ((status='sent' AND sent_at<?) OR (status='failed' AND created_at<?))").run(defaultSentBefore,defaultFailedBefore);
  return channelResult.changes+userResult.changes;
}

export function getNotificationPreference(guildId,discordId){
  const row=db.prepare("SELECT enabled FROM notification_optins WHERE guild_id=? AND discord_id=?").get(guildId,discordId);
  return row?Boolean(row.enabled):false;
}
export function getNotificationChannel(guildId){
  return db.prepare("SELECT notification_channel_id FROM guild_settings WHERE guild_id=?").get(guildId)?.notification_channel_id??null;
}


export function getDiscordNotificationDeliveryReport(guildId,days=7,now=Date.now()){
  const period=Number(days);
  if(![7,30,90].includes(period))throw new RangeError("Report period must be 7, 30, or 90 days");
  const rows=db.prepare("SELECT q.status,COUNT(*) AS count,AVG(q.attempts) AS average_attempts FROM discord_notification_queue q JOIN guild_settings g ON g.notification_channel_id=q.target_id WHERE q.destination_type='channel' AND g.guild_id=? AND q.created_at>=? AND q.created_at<=? GROUP BY q.status").all(String(guildId),now-period*86400000,now);
  const report={days:period,sent:0,failed:0,pending:0,averageAttempts:0};
  let completed=0,attempts=0;
  for(const row of rows){
    report[row.status]=row.count;
    if(row.status==="sent"||row.status==="failed"){completed+=row.count;attempts+=(row.average_attempts||0)*row.count;}
  }
  report.completed=completed;
  report.successRate=completed?Math.round(report.sent/completed*100):null;
  report.averageAttempts=completed?Math.round(attempts/completed*100)/100:0;
  return report;
}

export function getDiscordNotificationHistory(guildId,limit=10){
  return db.prepare("SELECT q.id,q.status,q.attempts,q.created_at,q.sent_at,q.last_error FROM discord_notification_queue q JOIN guild_settings g ON g.notification_channel_id=q.target_id WHERE q.destination_type='channel' AND g.guild_id=? ORDER BY q.id DESC LIMIT ?").all(String(guildId),Math.max(1,Math.min(20,limit)));
}

export function getFailedDiscordNotifications(guildId,limit=5){
  return db.prepare("SELECT q.id,q.attempts,q.last_error,q.created_at FROM discord_notification_queue q JOIN guild_settings g ON g.notification_channel_id=q.target_id WHERE q.destination_type='channel' AND q.status='failed' AND g.guild_id=? ORDER BY q.id DESC LIMIT ?").all(String(guildId),Math.max(1,Math.min(20,limit)));
}
export function retryFailedDiscordNotification(id,guildId){
  const result=db.prepare("UPDATE discord_notification_queue SET status='pending',attempts=0,next_attempt_at=?,last_error='' WHERE id=? AND status='failed' AND destination_type='channel' AND EXISTS (SELECT 1 FROM guild_settings g WHERE g.guild_id=? AND g.notification_channel_id=discord_notification_queue.target_id)").run(Date.now(),id,String(guildId));
  return result.changes===1;
}


export function getGuildForNotificationChannel(channelId){
  return db.prepare("SELECT guild_id FROM guild_settings WHERE notification_channel_id=? LIMIT 1").get(String(channelId))?.guild_id??null;
}
export function claimNotificationAdminAlert(guildId,now=Date.now(),cooldownMs=6*60*60*1000){
  const result=db.prepare("INSERT INTO notification_admin_alerts(guild_id,last_alert_at) VALUES (?,?) ON CONFLICT(guild_id) DO UPDATE SET last_alert_at=excluded.last_alert_at WHERE notification_admin_alerts.last_alert_at<=?").run(String(guildId),now,now-cooldownMs);
  return result.changes===1;
}
