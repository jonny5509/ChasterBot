import {randomUUID} from "node:crypto";
import {getAllLinkedAccounts,getGuildSettings,getOptedInUsers,getLockSnapshot,setLockSnapshot,enqueueDiscordNotification,getDueDiscordNotifications,markDiscordNotificationSent,markDiscordNotificationFailed,pruneDiscordNotificationQueue,getGuildForNotificationChannel,claimNotificationAdminAlert,pauseNotificationChannel,isNotificationChannelPaused} from "./db.js";
import {getTokensForDiscordUser} from "./oauth.js";
import {getMyLocks,getKeyholderLocks} from "./chaster.js";

const MAX_DELIVERY_ATTEMPTS=5;
const BASE_RETRY_MS=5000;
const MAX_RETRY_MS=300000;

function summarize(l){return{id:String(l._id||l.id||""),title:String(l.title||"Chaster lock").slice(0,80),status:String(l.status||"unknown"),endDate:l.endDate||null,updatedAt:l.updatedAt||null,frozen:Boolean(l.isFrozen),visible:l.isAllowedToViewTime!==false};}
function remain(d){if(!d)return "time unavailable";const s=Math.max(0,Math.floor((new Date(d).getTime()-Date.now())/1000));return Math.floor(s/86400)+"d "+Math.floor(s%86400/3600)+"h "+Math.floor(s%3600/60)+"m";}

export function notificationRetryDelay(attempts){
  return Math.min(MAX_RETRY_MS,BASE_RETRY_MS*2**Math.max(0,attempts));
}
export function isPermanentDiscordDeliveryError(error){
  return [403,404].includes(Number(error?.status))||[10003,10007,10013,50001,50007,50013].includes(Number(error?.code));
}
export function enqueueChasterReauthNotification(discordId){
  return enqueueDiscordNotification({
    dedupeKey:"chaster-reauth:"+String(discordId)+":"+randomUUID(),
    destinationType:"user",
    targetId:String(discordId),
    content:"Your ChasterBot connection needs attention. Chaster rejected the saved authorization. Run /link-chaster in the server and approve access again."
  });
}


function safeAdminFailureReason(error){
  const s=String(error?.message||error||"").toLowerCase();
  if(Number(error?.code)===10003||s.includes("unknown channel"))return "the configured channel is missing";
  if(Number(error?.code)===50001||Number(error?.code)===50013||s.includes("missing permissions"))return "the bot lacks channel permissions";
  if(Number(error?.status)===429)return "Discord rate limited delivery repeatedly";
  return "Discord rejected delivery after retries";
}
async function alertGuildOwnerOfNotificationFailure(client,item,error){
  try{
    const guildId=getGuildForNotificationChannel(item.target_id);
    if(!guildId)return false;
    const guild=client.guilds.cache.get(guildId)||await client.guilds.fetch(guildId);
    if(!guild?.ownerId||!claimNotificationAdminAlert(guildId))return false;
    return enqueueDiscordNotification({
      dedupeKey:"notification-admin-alert:"+guildId+":"+randomUUID(),
      destinationType:"user",
      targetId:guild.ownerId,
      content:"ChasterBot could not deliver a server notification. Reason: "+safeAdminFailureReason(error)+". Queue item ID: "+item.id+". In your server, run /notify-channel to select this channel again or choose a replacement, then use /notification-health and /notification-failures. Alerts are limited to one per server every six hours."
    });
  }catch(e){
    console.warn("Could not send notification failure alert:",e?.message||"unknown error");
    return false;
  }
}

let deliveryBusy=false;
export async function processPendingDiscordNotifications(client){
  if(deliveryBusy)return 0;
  deliveryBusy=true;
  let delivered=0;
  try{
    for(const item of getDueDiscordNotifications(20)){
      try{
        if(item.destination_type==="user"){
          const user=await client.users.fetch(item.target_id);
          await user.send(item.content);
        }else{
          const channel=await client.channels.fetch(item.target_id);
          if(!channel?.isTextBased())throw Object.assign(new Error("Notification channel is unavailable or not text-based"),{status:404});
          const allowedMentions=JSON.parse(item.allowed_mentions||"{}");
          await channel.send({content:item.content,allowedMentions});
        }
        markDiscordNotificationSent(item.id);
        delivered++;
      }catch(error){
        const permanent=isPermanentDiscordDeliveryError(error);
        const attempts=Number(item.attempts||0);
        const retryAt=permanent||attempts+1>=MAX_DELIVERY_ATTEMPTS?null:Date.now()+notificationRetryDelay(attempts);
        markDiscordNotificationFailed(item.id,error?.message||"Discord delivery failed",{retryAt,maxAttempts:MAX_DELIVERY_ATTEMPTS});
        if(retryAt===null||attempts+1>=MAX_DELIVERY_ATTEMPTS){if(item.destination_type==="channel"){const guildId=getGuildForNotificationChannel(item.target_id);if(guildId)pauseNotificationChannel(guildId,item.target_id,safeAdminFailureReason(error));await alertGuildOwnerOfNotificationFailure(client,item,error);}}
        console.warn("Discord notification delivery failed:",item.id,error?.message||"unknown error",permanent?"(permanent)":"");
      }
    }
  }finally{deliveryBusy=false;}
  return delivered;
}

export function startDiscordNotificationWorker(client){
  pruneDiscordNotificationQueue();
  const run=()=>processPendingDiscordNotifications(client).catch(e=>console.warn("Notification queue worker failed:",e.message));
  run();
  const timer=setInterval(run,10000);
  timer.unref?.();
  return ()=>clearInterval(timer);
}

export function startNotificationPolling(client){
  let busy=false;
  const poll=async()=>{
    if(busy)return;
    busy=true;
    try{
      const settings=getGuildSettings();
      for(const acc of getAllLinkedAccounts()){
        const subs=settings.filter(x=>!isNotificationChannelPaused(x.guild_id,x.notification_channel_id)&&getOptedInUsers(x.guild_id).includes(acc.discord_id));
        if(!subs.length)continue;
        try{
          const t=await getTokensForDiscordUser(acc.discord_id);
          if(!t)continue;
          const own=await getMyLocks(t.access_token).catch(()=>[]),kh=await getKeyholderLocks(t.access_token).catch(()=>({locks:[]})),held=Array.isArray(kh)?kh:(kh?.locks||[]),all=[...(Array.isArray(own)?own:[]),...held];
          for(const raw of all){
            const l=summarize(raw);
            if(!l.id)continue;
            const fp=JSON.stringify([l.status,l.endDate,l.updatedAt,l.frozen]),old=getLockSnapshot(acc.discord_id,l.id);
            if(!old){setLockSnapshot(acc.discord_id,l.id,fp);continue;}
            if(old===fp)continue;
            const content="<@"+acc.discord_id+"> Chaster update: **"+l.title+"** · "+l.status+(l.frozen?" · frozen":"")+(l.visible?" · "+remain(l.endDate):"");
            for(const s of subs){
              enqueueDiscordNotification({
                dedupeKey:"lock-change:"+acc.discord_id+":"+s.guild_id+":"+l.id+":"+Buffer.from(old).toString("base64url")+":"+Buffer.from(fp).toString("base64url"),
                destinationType:"channel",
                targetId:s.notification_channel_id,
                content,
                allowedMentions:{users:[acc.discord_id]}
              });
            }
            setLockSnapshot(acc.discord_id,l.id,fp);
          }
        }catch(e){console.warn("Notification poll skipped:",e.message);}
      }
    }finally{busy=false;}
  };
  setTimeout(poll,15000).unref?.();
  const timer=setInterval(poll,300000);
  timer.unref?.();
}
