import {markChasterLinkNeedsReauth} from "./db.js";
import {discordUserForChasterToken,notifyChasterAuthFailure} from "./auth-health.js";
const API_BASE=process.env.CHASTER_API_BASE||"https://api.chaster.app";
const MAX_GET_RETRIES=2;
const MAX_AUTOMATIC_RATE_LIMIT_WAIT_MS=1200;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function retryAfterMilliseconds(response){
  const value=response.headers?.get?.("retry-after");
  if(!value)return null;
  const seconds=Number(value);
  if(Number.isFinite(seconds)&&seconds>=0)return Math.ceil(seconds*1000);
  const date=Date.parse(value);
  return Number.isFinite(date)?Math.max(0,date-Date.now()):null;
}
function apiError(status,body,retryAfterMs=null){
  const error=new Error("Chaster API request failed ("+status+"): "+String(body||"").slice(0,160));
  error.status=status;
  error.retryAfterMs=retryAfterMs;
  if(status===401)error.code="CHASTER_REAUTH_REQUIRED";
  if(status===429)error.code="CHASTER_RATE_LIMITED";
  return error;
}
export async function chasterRequest(path,options={}){
  if(!options.token)throw new Error("Chaster account is not linked.");
  const method=String(options.method||"GET").toUpperCase();
  const safeToRetry=method==="GET";
  let attempt=0;
  while(true){
    let response;
    try{
      response=await fetch(new URL(path,API_BASE),{
        method,
        headers:{Authorization:"Bearer "+options.token,Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{})},
        ...(options.body?{body:JSON.stringify(options.body)}:{})
      });
    }catch(error){
      if(safeToRetry&&attempt<MAX_GET_RETRIES){
        await sleep(250*Math.pow(2,attempt));
        attempt++;
        continue;
      }
      throw error;
    }
    if(response.ok)return response.status===204?null:response.json();
    const retryAfterMs=response.status===429?retryAfterMilliseconds(response):null;
    const body=await response.text().catch(()=>"");
    if(response.status===429&&safeToRetry&&attempt<MAX_GET_RETRIES&&retryAfterMs!==null&&retryAfterMs<=MAX_AUTOMATIC_RATE_LIMIT_WAIT_MS){
      await sleep(retryAfterMs);
      attempt++;
      continue;
    }
    if([502,503,504].includes(response.status)&&safeToRetry&&attempt<MAX_GET_RETRIES){
      await sleep(250*Math.pow(2,attempt));
      attempt++;
      continue;
    }
    const error=apiError(response.status,body,retryAfterMs);
    if(response.status===401){
      const discordId=discordUserForChasterToken(options.token);
      if(discordId){
        error.discordId=discordId;
        error.notifyUser=markChasterLinkNeedsReauth(discordId,"Chaster rejected the access token");
        if(error.notifyUser)await notifyChasterAuthFailure(discordId);
      }
    }
    throw error;
  }
}
export function getMyLocks(token){return chasterRequest("/locks",{token});}
export function getKeyholderLocks(token){return chasterRequest("/keyholder/locks/search",{token,method:"POST",body:{status:"locked",page:0,limit:50}});}
export function getCurrentProfile(token){return chasterRequest("/auth/profile",{token});}
export function getSharedLocks(token){return chasterRequest("/shared-locks",{token});}
export function getConversations(token){return chasterRequest("/conversations",{token});}
export function getCalendarEvents(token){return chasterRequest("/calendar/events",{token});}
export function getNotificationCounts(token){return chasterRequest("/notifications/counts",{token});}
export function getLockDetails(lockId,token){return chasterRequest("/locks/"+encodeURIComponent(lockId),{token});}
export function getLockSeal(lockId,token){return chasterRequest("/locks/"+encodeURIComponent(lockId)+"/seal",{token});}
export function getKeyholderNotes(lockId,token){return chasterRequest("/keyholder/notes/lock/"+encodeURIComponent(lockId),{token});}
export function getChasterSettings(token){return chasterRequest("/settings",{token});}
export function getPermissionDefinitions(token){return chasterRequest("/permissions/definitions",{token});}
export function updateLockTime(lockId,duration,token){return chasterRequest("/locks/"+encodeURIComponent(lockId)+"/update-time",{token,method:"POST",body:{duration}});}

export function getUserProfileOverview(username,token){return chasterRequest("/user-profile/"+encodeURIComponent(username)+"/overview",{token});}
export function getUserProfileStatistics(username,token){return chasterRequest("/user-profile/"+encodeURIComponent(username)+"/statistics",{token});}
export function getUserAchievements(userId,token){return chasterRequest("/achievements/user/"+encodeURIComponent(userId),{token});}
export function getUserBadgeCount(token){return chasterRequest("/users/badge/count",{token});}
export function getLockHistory(lockId,token){return chasterRequest("/locks/"+encodeURIComponent(lockId)+"/history",{token,method:"POST",body:{}});}
export function getKeyholderApplications(lockId,token){return chasterRequest("/locks/"+encodeURIComponent(lockId)+"/keyholder-applications",{token});}

export function getConversation(conversationId,token){return chasterRequest("/conversations/"+encodeURIComponent(conversationId),{token});}
export function getConversationMessages(conversationId,token){return chasterRequest("/conversations/"+encodeURIComponent(conversationId)+"/messages",{token});}
export function getSharedLockFavorite(sharedLockId,token){return chasterRequest("/shared-locks/"+encodeURIComponent(sharedLockId)+"/favorite",{token});}
export function addSharedLockFavorite(sharedLockId,token){return chasterRequest("/shared-locks/"+encodeURIComponent(sharedLockId)+"/favorite",{token,method:"PUT"});}
export function removeSharedLockFavorite(sharedLockId,token){return chasterRequest("/shared-locks/"+encodeURIComponent(sharedLockId)+"/favorite",{token,method:"DELETE"});}
export function getNotificationChannelHealth(token){return chasterRequest("/notifications/channels/health",{token});}
export function markNotificationRead(notificationId,token){return chasterRequest("/notifications/"+encodeURIComponent(notificationId)+"/read",{token,method:"POST"});}
export function markAllNotificationsRead(token){return chasterRequest("/notifications/read-all",{token,method:"POST"});}

export function getSharedLockDetails(sharedLockId,token){return chasterRequest("/shared-locks/"+encodeURIComponent(sharedLockId),{token});}
export function getSharedLockTags(token){return chasterRequest("/shared-lock-tags",{token});}
export function getExtensions(token){return chasterRequest("/extensions",{token});}
export function getExploreCategories(token){return chasterRequest("/explore/categories",{token});}
export function getCalendarStatistics(token){return chasterRequest("/user-profile/calendar-statistics",{token});}
export function getBlockedUsers(token){return chasterRequest("/blocks",{token});}
export function getAchievementCategories(token){return chasterRequest("/achievements/categories",{token});}
export function getIgnoredUsers(token){return chasterRequest("/messaging/ignored-users",{token});}
export function getLockStatsResetConfig(token){return chasterRequest("/lock-stats/reset-config",{token});}
export function getCommunityEventCategories(token){return chasterRequest("/community-event/categories",{token});}
export function getPublicLocks(userId,token){return chasterRequest("/locks/user/"+encodeURIComponent(userId),{token});}
export function createCalendarEvent(data,token){return chasterRequest("/calendar/events",{token,method:"POST",body:data});}
export function updateCalendarEvent(eventId,data,token){return chasterRequest("/calendar/events/"+encodeURIComponent(eventId),{token,method:"PATCH",body:data});}
export function deleteCalendarEvent(eventId,token){return chasterRequest("/calendar/events/"+encodeURIComponent(eventId),{token,method:"DELETE"});}

export function archiveSharedLock(sharedLockId,token){return chasterRequest("/shared-locks/"+encodeURIComponent(sharedLockId)+"/archive",{token,method:"POST"});}

export function deleteKeyholderNotes(lockId,token){return chasterRequest("/keyholder/notes/lock/"+encodeURIComponent(lockId),{token,method:"DELETE"});}
