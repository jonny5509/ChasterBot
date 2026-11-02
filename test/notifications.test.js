import test from "node:test";
import assert from "node:assert/strict";
import {notificationRetryDelay,isPermanentDiscordDeliveryError} from "../src/notifications.js";
import {enqueueDiscordNotification,getDueDiscordNotifications,markDiscordNotificationSent,setNotificationOptIn,getNotificationPreference,getNotificationChannel,setNotificationChannel,markDiscordNotificationFailed,getFailedDiscordNotifications,retryFailedDiscordNotification,getDiscordNotificationQueueStats,getGuildForNotificationChannel,claimNotificationAdminAlert,pauseNotificationChannel,getNotificationChannelPause,isNotificationChannelPaused,getDiscordNotificationHistory,getDiscordNotificationDeliveryReport,getNotificationRetentionDays,getGuildRoleSettings,getMemberSessionDashboard,createSessionInvite,deleteSessionInvite,recordPrivateSession,setGuildRoles,setNotificationRetentionDays,pruneDiscordNotificationQueue} from "../src/db.js";

test("notification retry delay grows exponentially and is capped",()=>{
  assert.equal(notificationRetryDelay(0),5000);
  assert.equal(notificationRetryDelay(1),10000);
  assert.equal(notificationRetryDelay(2),20000);
  assert.equal(notificationRetryDelay(20),300000);
});

test("permanent Discord delivery failures are not retried",()=>{
  for(const error of [{status:403},{status:404},{code:50007},{code:10013},{code:10003}]){
    assert.equal(isPermanentDiscordDeliveryError(error),true);
  }
  for(const error of [{status:429},{status:500},{code:"ECONNRESET"},new Error("temporary")]){
    assert.equal(isPermanentDiscordDeliveryError(error),false);
  }
});

test("notification queue persists an event and suppresses duplicate enqueue",()=>{
  const key="notification-test:"+Date.now()+":"+Math.random();
  assert.equal(enqueueDiscordNotification({dedupeKey:key,destinationType:"user",targetId:"123456789012345678",content:"Test notification"}),true);
  assert.equal(enqueueDiscordNotification({dedupeKey:key,destinationType:"user",targetId:"123456789012345678",content:"Duplicate"}),false);
  const row=getDueDiscordNotifications(100).find(x=>x.dedupe_key===key);
  assert.ok(row);
  assert.equal(row.content,"Test notification");
  markDiscordNotificationSent(row.id);
  assert.equal(getDueDiscordNotifications(100).some(x=>x.dedupe_key===key),false);
});

test("notification preferences can be paused and resumed per server",()=>{
  const guild="notification-pref-guild-"+Date.now(),user="notification-pref-user-"+Math.random();
  assert.equal(getNotificationPreference(guild,user),false);
  setNotificationOptIn(guild,user,true);
  assert.equal(getNotificationPreference(guild,user),true);
  setNotificationOptIn(guild,user,false);
  assert.equal(getNotificationPreference(guild,user),false);
  setNotificationChannel(guild,"notification-channel-"+Date.now(),"test-admin");
  assert.match(getNotificationChannel(guild),/^notification-channel-/);
});


test("failed channel notifications are visible and retryable only by their own server",()=>{
  const guild="notification-retry-guild-"+Date.now()+"-"+Math.random();
  const otherGuild=guild+"-other";
  const channel="notification-retry-channel-"+Date.now()+"-"+Math.random();
  setNotificationChannel(guild,channel,"test-admin");
  const key="notification-retry:"+guild;
  assert.equal(enqueueDiscordNotification({dedupeKey:key,destinationType:"channel",targetId:channel,content:"PRIVATE MESSAGE BODY"}),true);
  const queued=getDueDiscordNotifications(100).find(x=>x.dedupe_key===key);
  assert.ok(queued);
  markDiscordNotificationFailed(queued.id,"Missing Permissions",{retryAt:null});
  const failed=getFailedDiscordNotifications(guild,5);
  const row=failed.find(x=>x.id===queued.id);
  assert.ok(row);
  assert.equal(row.attempts,1);
  assert.equal(Object.hasOwn(row,"content"),false);
  assert.equal(Object.hasOwn(row,"target_id"),false);
  assert.equal(retryFailedDiscordNotification(queued.id,otherGuild),false);
  assert.equal(retryFailedDiscordNotification(queued.id,guild),true);
  assert.equal(retryFailedDiscordNotification(queued.id,guild),false);
  assert.equal(getDiscordNotificationQueueStats(guild).pending,1);
  const retried=getDueDiscordNotifications(100).find(x=>x.id===queued.id);
  assert.equal(retried.attempts,0);
  assert.equal(retried.last_error,"");
});


test("notification failure alerts resolve the owning server and enforce a six-hour cooldown",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="notification-alert-guild-"+suffix;
  const channel="notification-alert-channel-"+suffix;
  const now=Date.now();
  setNotificationChannel(guild,channel,"test-admin");
  assert.equal(getGuildForNotificationChannel(channel),guild);
  assert.equal(getGuildForNotificationChannel("unknown-"+suffix),null);
  assert.equal(claimNotificationAdminAlert(guild,now),true);
  assert.equal(claimNotificationAdminAlert(guild,now+60*60*1000),false);
  assert.equal(claimNotificationAdminAlert(guild,now+6*60*60*1000),true);
  assert.equal(claimNotificationAdminAlert(guild+"-other",now+6*60*60*1000),true);
});


test("terminal channel failures can pause delivery until an administrator reconfigures the channel",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="notification-pause-guild-"+suffix;
  const channel="notification-pause-channel-"+suffix;
  const replacement="notification-pause-replacement-"+suffix;
  setNotificationChannel(guild,channel,"test-admin");
  assert.equal(isNotificationChannelPaused(guild,channel),false);
  pauseNotificationChannel(guild,channel,"the bot lacks channel permissions");
  assert.equal(isNotificationChannelPaused(guild,channel),true);
  assert.equal(getNotificationChannelPause(guild).reason,"the bot lacks channel permissions");
  assert.equal(isNotificationChannelPaused(guild,replacement),false);
  setNotificationChannel(guild,replacement,"test-admin");
  assert.equal(getNotificationChannelPause(guild),null);
  assert.equal(isNotificationChannelPaused(guild,replacement),false);
});


test("notification history is scoped to the server and omits message and destination details",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="notification-history-guild-"+suffix;
  const otherGuild=guild+"-other";
  const channel="notification-history-channel-"+suffix;
  setNotificationChannel(guild,channel,"test-admin");
  const key="notification-history:"+suffix;
  assert.equal(enqueueDiscordNotification({dedupeKey:key,destinationType:"channel",targetId:channel,content:"PRIVATE BODY"}),true);
  const queued=getDueDiscordNotifications(100).find(x=>x.dedupe_key===key);
  assert.ok(queued);
  markDiscordNotificationSent(queued.id);
  const history=getDiscordNotificationHistory(guild,10);
  const row=history.find(x=>x.id===queued.id);
  assert.ok(row);
  assert.equal(row.status,"sent");
  assert.equal(Object.hasOwn(row,"content"),false);
  assert.equal(Object.hasOwn(row,"target_id"),false);
  assert.equal(getDiscordNotificationHistory(otherGuild,10).some(x=>x.id===queued.id),false);
});


test("notification retention is configurable per server and cleanup preserves pending deliveries",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="notification-retention-guild-"+suffix;
  const channel="notification-retention-channel-"+suffix;
  setNotificationChannel(guild,channel,"test-admin");
  assert.equal(getNotificationRetentionDays(guild),30);
  assert.equal(setNotificationRetentionDays(guild,7,"test-admin"),7);
  assert.equal(getNotificationRetentionDays(guild),7);
  assert.throws(()=>setNotificationRetentionDays(guild,14,"test-admin"),/7, 30, or 90/);
  const sentKey="notification-retention-sent:"+suffix;
  const pendingKey="notification-retention-pending:"+suffix;
  assert.equal(enqueueDiscordNotification({dedupeKey:sentKey,destinationType:"channel",targetId:channel,content:"old sent"}),true);
  const sent=getDueDiscordNotifications(100).find(x=>x.dedupe_key===sentKey);
  markDiscordNotificationSent(sent.id);
  assert.equal(enqueueDiscordNotification({dedupeKey:pendingKey,destinationType:"channel",targetId:channel,content:"pending"}),true);
  const future=Date.now()+8*86400000;
  pruneDiscordNotificationQueue(future);
  const history=getDiscordNotificationHistory(guild,20);
  assert.equal(history.some(x=>x.id===sent.id),false);
  assert.equal(history.some(x=>x.status==="pending"),true);
});


test("notification delivery report is time-windowed and scoped to its server",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="notification-report-guild-"+suffix;
  const otherGuild=guild+"-other";
  const channel="notification-report-channel-"+suffix;
  setNotificationChannel(guild,channel,"test-admin");
  const sentKey="notification-report-sent:"+suffix;
  const failedKey="notification-report-failed:"+suffix;
  const pendingKey="notification-report-pending:"+suffix;
  for(const key of [sentKey,failedKey,pendingKey]){
    assert.equal(enqueueDiscordNotification({dedupeKey:key,destinationType:"channel",targetId:channel,content:"PRIVATE REPORT CONTENT"}),true);
  }
  const queued=getDueDiscordNotifications(100);
  const sent=queued.find(x=>x.dedupe_key===sentKey);
  const failed=queued.find(x=>x.dedupe_key===failedKey);
  markDiscordNotificationSent(sent.id);
  markDiscordNotificationFailed(failed.id,"Missing Permissions",{retryAt:null});
  const report=getDiscordNotificationDeliveryReport(guild,7,Date.now()+1000);
  assert.equal(report.sent,1);
  assert.equal(report.failed,1);
  assert.equal(report.pending,1);
  assert.equal(report.completed,2);
  assert.equal(report.successRate,50);
  assert.equal(report.averageAttempts,0.5);
  const other=getDiscordNotificationDeliveryReport(otherGuild,7);
  assert.equal(other.completed,0);
  assert.equal(other.successRate,null);
  assert.throws(()=>getDiscordNotificationDeliveryReport(guild,14),/7, 30, or 90/);
});


test("member dashboard session data is scoped to the member and server",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="dashboard-guild-"+suffix;
  const otherGuild=guild+"-other";
  const member="dashboard-member-"+suffix;
  const partner="dashboard-partner-"+suffix;
  const outsider="dashboard-outsider-"+suffix;
  const thread="dashboard-thread-"+suffix;
  setGuildRoles(guild,"wearer-role-"+suffix,"keyholder-role-"+suffix,"admin");
  assert.equal(getGuildRoleSettings(guild).wearer_role_id,"wearer-role-"+suffix);
  createSessionInvite("dashboard-invite-"+suffix,guild,"parent-channel",partner,member,Date.now()+600000);
  recordPrivateSession("dashboard-session-"+suffix,guild,thread,member,partner);
  const data=getMemberSessionDashboard(guild,member);
  assert.equal(data.sessions.length,1);
  assert.equal(data.sessions[0].thread_id,thread);
  assert.equal(data.invites.length,1);
  assert.equal(data.invites[0].inviter_id,partner);
  assert.equal(getMemberSessionDashboard(guild,outsider).sessions.length,0);
  assert.equal(getMemberSessionDashboard(otherGuild,member).sessions.length,0);
});


test("session invitations can only be cancelled by a participant in the same server",()=>{
  const suffix=Date.now()+"-"+Math.random();
  const guild="session-cancel-guild-"+suffix;
  const otherGuild=guild+"-other";
  const inviter="session-cancel-inviter-"+suffix;
  const invitee="session-cancel-invitee-"+suffix;
  const outsider="session-cancel-outsider-"+suffix;
  const inviteId="session-cancel-invite-"+suffix;
  createSessionInvite(inviteId,guild,"channel",inviter,invitee,Date.now()+600000);
  assert.equal(deleteSessionInvite(inviteId,otherGuild,inviter),false);
  assert.equal(deleteSessionInvite(inviteId,guild,outsider),false);
  assert.equal(deleteSessionInvite(inviteId,guild,invitee),true);
  assert.equal(deleteSessionInvite(inviteId,guild,inviter),false);
});
