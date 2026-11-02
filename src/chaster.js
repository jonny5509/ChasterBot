const API_BASE=process.env.CHASTER_API_BASE||"https://api.chaster.app";
export async function chasterRequest(path,options={}){if(!options.token)throw new Error("Chaster account is not linked.");const r=await fetch(new URL(path,API_BASE),{method:options.method||"GET",headers:{Authorization:"Bearer "+options.token,Accept:"application/json",...(options.body?{"Content-Type":"application/json"}:{})},...(options.body?{body:JSON.stringify(options.body)}:{})});if(!r.ok){const body=await r.text().catch(()=>"");throw new Error("Chaster API request failed ("+r.status+"): "+body.slice(0,160));}return r.status===204?null:r.json();}
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
