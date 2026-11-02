import test from "node:test";
import assert from "node:assert/strict";
import {notificationRetryDelay,isPermanentDiscordDeliveryError} from "../src/notifications.js";\nimport {enqueueDiscordNotification,getDueDiscordNotifications,markDiscordNotificationSent,setNotificationOptIn,getNotificationPreference,getNotificationChannel,setNotificationChannel} from "../src/db.js";

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
