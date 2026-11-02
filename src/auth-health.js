const owners=new Map();
export function rememberChasterToken(token,discordId){if(token&&discordId){owners.set(token,String(discordId));if(owners.size>5000)owners.delete(owners.keys().next().value);}}
export function discordUserForChasterToken(token){return owners.get(token)||null;}
let authFailureNotifier=null;
export function setChasterAuthFailureNotifier(fn){authFailureNotifier=typeof fn==="function"?fn:null;}
export async function notifyChasterAuthFailure(discordId){if(authFailureNotifier&&discordId)await authFailureNotifier(String(discordId));}
