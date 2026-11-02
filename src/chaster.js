import {markChasterLinkNeedsReauth} from "./db.js";
import {discordUserForChasterToken} from "./auth-health.js";
const API_BASE=process.env.CHASTER_API_BASE||"https://api.chaster.app";
export async function chasterRequest(path,options={}){if(!options.token)throw new Error("Chaster account is not linked.");const r=await fetch(new URL(path,API_BASE),{method:options.method||"GET",headers:{Authorization:"Bearer "+options.token,Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});if(!r.ok){const body=await r.text().catch(()=>"");const error=new Error("Chaster API request failed ("+r.status+"): "+body.slice(0,160));error.status=r.status;error.code=r.status===401?"CHASTER_REAUTH_REQUIRED":undefined;if(r.status===401){const discordId=discordUserForChasterToken(options.token);if(discordId){error.discordId=discordId;markChasterLinkNeedsReauth(discordId,"Chaster rejected the access token");}}throw error;}return r.status===204?null:r.json();}
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
