import {getRoleSettings,getAllLinkedAccounts,audit} from "./db.js";
import {getTokensForDiscordUser} from "./oauth.js";
import {getMyLocks,getKeyholderLocks} from "./chaster.js";
import {shouldHaveWearerRole,shouldHaveKeyholderRole,normalizeLockRows} from "./role-utils.js";

async function applyRole(guild,member,roleId,shouldHave,removeInactive=true){
  if(!roleId)return "not-configured";
  const role=await guild.roles.fetch(roleId).catch(()=>null);
  if(!role)return "missing-role";
  if(!role.editable)return "role-hierarchy";
  const has=member.roles.cache.has(roleId);
  if(shouldHave&&!has){await member.roles.add(role,"Chaster role sync");return "added";}
  if(!shouldHave&&has&&removeInactive){await member.roles.remove(role,"Chaster role sync");return "removed";}
  return "unchanged";
}
export async function syncUserRoles(client,discordId){
  const account=getAllLinkedAccounts().find(x=>x.discord_id===discordId);
  if(!account)throw new Error("Link your Chaster account first with /link-chaster.");
  const settings=getRoleSettings().filter(s=>s.role_sync_enabled!==0&&(s.wearer_role_id||s.keyholder_role_id||s.locked_role_id||s.active_role_id));
  if(!settings.length)return {wearer:false,keyholder:false,servers:0,changed:0,message:"Automatic role sync is disabled or no Chaster roles are configured in your servers."};
  const tokens=await getTokensForDiscordUser(discordId);
  const [ownRaw,keyholderRaw]=await Promise.all([getMyLocks(tokens.access_token),getKeyholderLocks(tokens.access_token)]);
  const wearer=shouldHaveWearerRole(ownRaw);
  const keyholder=shouldHaveKeyholderRole(keyholderRaw);
  const ownLocks=normalizeLockRows(ownRaw);
  const locked=ownLocks.some(lock=>String(lock?.status||"").toLowerCase()==="locked");
  const active=ownLocks.some(lock=>String(lock?.status||"").toLowerCase()==="active");
  let changed=0,servers=0;
  for(const s of settings){
    if(!s.wearer_role_id&&!s.keyholder_role_id&&!s.locked_role_id&&!s.active_role_id)continue;
    const guild=await client.guilds.fetch(s.guild_id).catch(()=>null);
    if(!guild)continue;
    const member=await guild.members.fetch(discordId).catch(()=>null);
    if(!member)continue;
    servers++;
    const removeInactive=s.role_remove_inactive!==0;
    const a=await applyRole(guild,member,s.wearer_role_id,wearer,removeInactive);
    const b=await applyRole(guild,member,s.keyholder_role_id,keyholder,removeInactive);
    const c=await applyRole(guild,member,s.locked_role_id,locked,removeInactive);
    const d=await applyRole(guild,member,s.active_role_id,active,removeInactive);
    if(a==="added"||a==="removed")changed++;
    if(b==="added"||b==="removed")changed++;
    if(c==="added"||c==="removed")changed++;
    if(d==="added"||d==="removed")changed++;
    if([a,b,c,d].some(x=>x==="missing-role"||x==="role-hierarchy"))audit(guild.id,discordId,"role_sync_warning","Check role IDs and bot role hierarchy.");
    else audit(guild.id,discordId,"role_sync","wearer="+wearer+", keyholder="+keyholder+", locked="+locked+", active="+active+", remove_inactive="+removeInactive+", changed="+changed);
  }
  return {wearer,keyholder,servers,changed,message:"Chaster roles synced.\nWearer: "+(wearer?"active lock detected":"no active wearer lock detected")+"\nKeyholder: "+(keyholder?"active keyholder locks detected":"no active keyholder locks detected")+"\nServers checked: "+servers+" · role changes: "+changed};
}
export function startRoleSyncPolling(client){
  let busy=false;
  const run=async()=>{
    if(busy)return;
    busy=true;
    try{
      for(const account of getAllLinkedAccounts()){
        try{await syncUserRoles(client,account.discord_id);}
        catch(e){console.warn("Role sync skipped for linked account:",e.message);}
      }
    }finally{busy=false;}
  };
  setTimeout(run,30000);
  setInterval(run,600000);
}
