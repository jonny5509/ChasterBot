import {getRoleSettings,getAllLinkedAccounts,audit,recordRoleSyncStarted,recordRoleSyncCompleted} from "./db.js";
import {getTokensForDiscordUser} from "./oauth.js";
import {getMyLocks,getKeyholderLocks} from "./chaster.js";
import {shouldHaveWearerRole,shouldHaveKeyholderRole,getLockStatusRoleState,hasMinimumLockedDuration} from "./role-utils.js";

const DEFAULT_INTERVAL_MINUTES=10;
const MIN_INTERVAL_MINUTES=1;
const MAX_INTERVAL_MINUTES=1440;
const STARTUP_DELAY_MS=30000;
const startedClients=new WeakSet();

export function getRoleSyncIntervalMinutes(value=process.env.ROLE_SYNC_INTERVAL_MINUTES){
  if(value===undefined||value===null||String(value).trim()==="")return DEFAULT_INTERVAL_MINUTES;
  const parsed=Number(value);
  if(!Number.isInteger(parsed)||parsed<MIN_INTERVAL_MINUTES||parsed>MAX_INTERVAL_MINUTES){
    console.warn("Invalid ROLE_SYNC_INTERVAL_MINUTES; using default of 10 minutes (valid range: 1–1440).");
    return DEFAULT_INTERVAL_MINUTES;
  }
  return parsed;
}

async function applyRole(guild,member,roleId,shouldHave,removeInactive=true){
  if(!roleId)return "not-configured";
  const role=await guild.roles.fetch(roleId).catch(()=>null);
  if(!role)return "missing-role";
  if(!role.editable)return "role-hierarchy";
  const has=member.roles.cache.has(roleId);
  if(shouldHave&&!has){await member.roles.add(role,"Chaster role sync");return "added";}
  if(!shouldHave&&has&&removeInactive){await member.roles.remove(roleId,"Chaster role sync");return "removed";}
  return "unchanged";
}
export async function syncUserRoles(client,discordId){
  const account=getAllLinkedAccounts().find(x=>x.discord_id===discordId);
  if(!account)throw new Error("Link your Chaster account first with /link-chaster.");
  const settings=getRoleSettings().filter(s=>s.role_sync_enabled!==0&&(s.wearer_role_id||s.keyholder_role_id||s.locked_role_id||s.active_role_id||s.minimum_locked_role_id));
  if(!settings.length)return {wearer:false,keyholder:false,servers:0,changed:0,message:"Automatic role sync is disabled or no Chaster roles are configured in your servers."};
  const tokens=await getTokensForDiscordUser(discordId);
  const [ownRaw,keyholderRaw]=await Promise.all([getMyLocks(tokens.access_token),getKeyholderLocks(tokens.access_token)]);
  const wearer=shouldHaveWearerRole(ownRaw);
  const keyholder=shouldHaveKeyholderRole(keyholderRaw);
  const {locked,active}=getLockStatusRoleState(ownRaw);
  let changed=0,servers=0;
  for(const s of settings){
    if(!s.wearer_role_id&&!s.keyholder_role_id&&!s.locked_role_id&&!s.active_role_id&&!s.minimum_locked_role_id)continue;
    const guild=await client.guilds.fetch(s.guild_id).catch(()=>null);
    if(!guild)continue;
    const member=await guild.members.fetch(discordId).catch(()=>null);
    if(!member)continue;
    servers++;
    const removeInactive=s.role_remove_inactive!==0;
    const minimumLocked=hasMinimumLockedDuration(ownRaw,s.minimum_locked_hours);
    const results=await Promise.all([
      applyRole(guild,member,s.wearer_role_id,wearer,removeInactive),
      applyRole(guild,member,s.keyholder_role_id,keyholder,removeInactive),
      applyRole(guild,member,s.locked_role_id,locked,removeInactive),
      applyRole(guild,member,s.active_role_id,active,removeInactive),
      applyRole(guild,member,s.minimum_locked_role_id,minimumLocked,removeInactive)
    ]);
    changed+=results.filter(x=>x==="added"||x==="removed").length;
    if(results.some(x=>x==="missing-role"||x==="role-hierarchy"))audit(guild.id,discordId,"role_sync_warning","Check role IDs and bot role hierarchy.");
    else audit(guild.id,discordId,"role_sync","wearer="+wearer+", keyholder="+keyholder+", locked="+locked+", active="+active+", minimum_locked="+minimumLocked+", minimum_locked_hours="+(s.minimum_locked_hours||0)+", remove_inactive="+removeInactive+", changed="+changed);
  }
  return {wearer,keyholder,servers,changed,message:"Chaster roles synced.\nWearer: "+(wearer?"active lock detected":"no active wearer lock detected")+"\nKeyholder: "+(keyholder?"active keyholder locks detected":"no active keyholder locks detected")+"\nServers checked: "+servers+" · role changes: "+changed};
}
export function startRoleSyncPolling(client){
  if(!client||typeof client!=="object"||startedClients.has(client))return;
  startedClients.add(client);
  const intervalMinutes=getRoleSyncIntervalMinutes();
  const intervalMs=intervalMinutes*60*1000;
  let busy=false;
  const run=async()=>{
    if(busy)return;
    busy=true;
    const accounts=getAllLinkedAccounts();
    const startedAt=Date.now();
    let succeeded=0,failed=0,lastError="";
    recordRoleSyncStarted(accounts.length,intervalMinutes,startedAt);
    try{
      for(const account of accounts){
        try{await syncUserRoles(client,account.discord_id);succeeded++;}
        catch(e){
          failed++;
          lastError=String(e?.message||"Role sync failed").slice(0,500);
          console.warn("Role sync skipped for linked account:",lastError);
        }
      }
    }catch(e){
      failed++;
      lastError=String(e?.message||"Role sync scheduler failed").slice(0,500);
      console.error("Role sync cycle failed:",lastError);
    }finally{
      recordRoleSyncCompleted({succeeded,failed,lastError,now:Date.now()});
      busy=false;
      setTimeout(run,intervalMs);
    }
  };
  setTimeout(run,STARTUP_DELAY_MS);
  console.log("Automatic role sync scheduled every "+intervalMinutes+" minute(s).");
}
