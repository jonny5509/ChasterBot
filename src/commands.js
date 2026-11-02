import {SlashCommandBuilder,PermissionFlagsBits,ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,ModalBuilder,TextInputBuilder,TextInputStyle} from "discord.js";
import {ensureProfile,leaderboard,createChallenge,joinChallenge,approveChallenge,setNotificationChannel,setNotificationOptIn,getNotificationPreference,getNotificationChannel,getDiscordNotificationQueueStats,getFailedDiscordNotifications,retryFailedDiscordNotification,recentAudit,addPoints,addRewardItem,listRewardItems,audit,getLinkedAccount,deleteLinkedAccount,getChasterLinkHealth,setGuildRoles,setSessionChannel,getSessionChannel,createSessionInvite,consumeSessionInvite,getRoleSettings,getNotificationChannelPause,getDiscordNotificationHistory,getDiscordNotificationDeliveryReport,getNotificationRetentionDays,setNotificationRetentionDays,getGuildRoleSettings,getMemberSessionDashboard,recordPrivateSession,deleteSessionInvite,deletePrivateSession,recordSessionActivity,getMemberSessionActivity} from "./db.js";
import {createAuthorizationUrl,getTokensForDiscordUser} from "./oauth.js";
import {getMyLocks,getKeyholderLocks,updateLockTime,getCurrentProfile,getSharedLocks,getConversations,getCalendarEvents,getNotificationCounts,getLockDetails,getLockSeal,getKeyholderNotes,deleteKeyholderNotes,getChasterSettings,getPermissionDefinitions,getUserProfileOverview,getUserProfileStatistics,getUserAchievements,getUserBadgeCount,getLockHistory,getKeyholderApplications,getConversation,getConversationMessages,getSharedLockFavorite,addSharedLockFavorite,removeSharedLockFavorite,getNotificationChannelHealth,markNotificationRead,markAllNotificationsRead,getSharedLockDetails,getSharedLockTags,getExtensions,getExploreCategories,getCalendarStatistics,getBlockedUsers,getAchievementCategories,getIgnoredUsers,getLockStatsResetConfig,getCommunityEventCategories,getPublicLocks,createCalendarEvent,updateCalendarEvent,deleteCalendarEvent,archiveSharedLock} from "./chaster.js";
import {keyholderReply} from "./persona.js";
import {randomUUID} from "node:crypto";
import {syncUserRoles} from "./role-sync.js";
import {consumeConfirmation} from "./confirmations.js";
import {isOwnedResourceListed} from "./owned-resources.js";
import {getDashboardCommandGroups} from "./dashboard-commands.js";
const pending=new Map();
export const commands=[
new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
new SlashCommandBuilder().setName("dashboard").setDescription("Open your ChasterBot roles and private session dashboard."),
new SlashCommandBuilder().setName("link-chaster").setDescription("Securely link your Chaster account."),
new SlashCommandBuilder().setName("chaster-link-status").setDescription("Check your Chaster connection health."),
new SlashCommandBuilder().setName("unlink-chaster").setDescription("Remove your saved Chaster connection."),
new SlashCommandBuilder().setName("profile").setDescription("Show your profile and points."),
new SlashCommandBuilder().setName("leaderboard").setDescription("Show the community leaderboard."),
new SlashCommandBuilder().setName("lock-status").setDescription("Show your Chaster locks and timers."),
new SlashCommandBuilder().setName("keyholder-locks").setDescription("List locks you keyhold."),
new SlashCommandBuilder().setName("chaster-profile").setDescription("Show your Chaster account profile."),
new SlashCommandBuilder().setName("shared-locks").setDescription("List your Chaster shared locks."),
new SlashCommandBuilder().setName("chaster-conversations").setDescription("List your Chaster private conversations."),
new SlashCommandBuilder().setName("chaster-calendar").setDescription("Show your Chaster calendar events."),
new SlashCommandBuilder().setName("chaster-notifications").setDescription("Show your Chaster notification counts."),
new SlashCommandBuilder().setName("lock-details").setDescription("Read details for a Chaster lock.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("lock-seal").setDescription("Read the seal status for a Chaster lock.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("keyholder-notes").setDescription("Read your private notes for a keyheld lock.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("keyholder-notes-delete").setDescription("Delete your private notes for a keyheld lock after confirmation.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("chaster-settings").setDescription("Read available Chaster application settings."),
new SlashCommandBuilder().setName("permission-catalog").setDescription("Show Chaster lock permission definitions."),
new SlashCommandBuilder().setName("chaster-user-overview").setDescription("View a public Chaster user profile overview.").addStringOption(o=>o.setName("username").setDescription("Chaster username").setRequired(true)),
new SlashCommandBuilder().setName("chaster-user-stats").setDescription("View public Chaster user statistics.").addStringOption(o=>o.setName("username").setDescription("Chaster username").setRequired(true)),
new SlashCommandBuilder().setName("chaster-achievements").setDescription("View your Chaster achievements."),
new SlashCommandBuilder().setName("chaster-badges").setDescription("View your Chaster badge count."),
new SlashCommandBuilder().setName("lock-history").setDescription("View the history of a Chaster lock.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("keyholder-applications").setDescription("View applications for a lock you control.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)),
new SlashCommandBuilder().setName("chaster-conversation").setDescription("View a Chaster conversation.").addStringOption(o=>o.setName("conversation_id").setDescription("Conversation ID").setRequired(true)),
new SlashCommandBuilder().setName("chaster-messages").setDescription("Read messages in a Chaster conversation.").addStringOption(o=>o.setName("conversation_id").setDescription("Conversation ID").setRequired(true)),
new SlashCommandBuilder().setName("shared-lock-favorite").setDescription("Check whether a shared lock is in your favorites.").addStringOption(o=>o.setName("shared_lock_id").setDescription("Shared lock ID").setRequired(true)),
new SlashCommandBuilder().setName("shared-lock-favorite-add").setDescription("Add a shared lock to your favorites.").addStringOption(o=>o.setName("shared_lock_id").setDescription("Shared lock ID").setRequired(true)),
new SlashCommandBuilder().setName("shared-lock-favorite-remove").setDescription("Remove a shared lock from your favorites.").addStringOption(o=>o.setName("shared_lock_id").setDescription("Shared lock ID").setRequired(true)),
new SlashCommandBuilder().setName("shared-lock-archive").setDescription("Archive one of your shared locks after confirmation.").addStringOption(o=>o.setName("shared_lock_id").setDescription("Shared lock ID").setRequired(true)),
new SlashCommandBuilder().setName("chaster-notification-health").setDescription("Check Chaster notification channel health."),
new SlashCommandBuilder().setName("chaster-notification-read").setDescription("Mark one Chaster notification as read.").addStringOption(o=>o.setName("notification_id").setDescription("Notification ID").setRequired(true)),
new SlashCommandBuilder().setName("chaster-notifications-read-all").setDescription("Mark all your Chaster notifications as read."),
new SlashCommandBuilder().setName("shared-lock-details").setDescription("View a Chaster shared lock.").addStringOption(o=>o.setName("shared_lock_id").setDescription("Shared lock ID").setRequired(true)),
new SlashCommandBuilder().setName("shared-lock-tags").setDescription("List Chaster shared lock tags."),
new SlashCommandBuilder().setName("chaster-extensions").setDescription("Browse available Chaster extensions."),
new SlashCommandBuilder().setName("chaster-explore-categories").setDescription("Browse Chaster Explore categories."),
new SlashCommandBuilder().setName("chaster-calendar-stats").setDescription("View your Chaster calendar statistics."),
new SlashCommandBuilder().setName("chaster-blocks").setDescription("List users you have blocked."),
new SlashCommandBuilder().setName("chaster-achievement-categories").setDescription("List Chaster achievement categories."),
new SlashCommandBuilder().setName("chaster-ignored-users").setDescription("List users ignored in Chaster messaging."),
new SlashCommandBuilder().setName("chaster-lock-stats-config").setDescription("View your Chaster lock-statistics reset configuration."),
new SlashCommandBuilder().setName("chaster-community-categories").setDescription("List Chaster community-event categories."),
new SlashCommandBuilder().setName("chaster-public-locks").setDescription("View public locks for a Chaster user ID.").addStringOption(o=>o.setName("user_id").setDescription("Chaster user ID").setRequired(true)),
new SlashCommandBuilder().setName("calendar-event-add").setDescription("Create a Chaster lock-period calendar event.").addStringOption(o=>o.setName("start_date").setDescription("Start date/time in ISO 8601 format").setRequired(true).setMaxLength(40)).addStringOption(o=>o.setName("end_date").setDescription("Optional end date/time in ISO 8601 format").setMaxLength(40)).addBooleanOption(o=>o.setName("all_day").setDescription("Mark this as an all-day event")).addStringOption(o=>o.setName("description").setDescription("Optional event description").setMaxLength(500)),
new SlashCommandBuilder().setName("calendar-event-edit").setDescription("Edit a Chaster calendar event.").addStringOption(o=>o.setName("event_id").setDescription("Calendar event ID").setRequired(true)).addStringOption(o=>o.setName("start_date").setDescription("New start date/time in ISO 8601 format").setMaxLength(40)).addStringOption(o=>o.setName("end_date").setDescription("New end date/time in ISO 8601 format").setMaxLength(40)).addBooleanOption(o=>o.setName("all_day").setDescription("New all-day setting")).addStringOption(o=>o.setName("description").setDescription("New description").setMaxLength(500)),
new SlashCommandBuilder().setName("calendar-event-delete").setDescription("Delete a Chaster calendar event after confirmation.").addStringOption(o=>o.setName("event_id").setDescription("Calendar event ID").setRequired(true)),
new SlashCommandBuilder().setName("time-change").setDescription("Propose a verified keyholder time change.").addStringOption(o=>o.setName("lock_id").setDescription("Chaster lock ID").setRequired(true)).addIntegerOption(o=>o.setName("seconds").setDescription("Positive adds; negative removes (max 24h)").setRequired(true).setMinValue(-86400).setMaxValue(86400)).addStringOption(o=>o.setName("reason").setDescription("Audit reason").setRequired(true).setMaxLength(160)),
new SlashCommandBuilder().setName("notifications").setDescription("Pause or resume lock updates in this server.").addBooleanOption(o=>o.setName("enabled").setDescription("Receive updates in this server").setRequired(true)),
new SlashCommandBuilder().setName("notification-status").setDescription("Check your lock-update preference in this server."),
new SlashCommandBuilder().setName("notification-queue-status").setDescription("View delivery queue counts without message contents.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-health").setDescription("Check notification channel access and delivery queue health.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-failures").setDescription("Review recent failed notification deliveries.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-history").setDescription("Review recent notification delivery outcomes.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-report").setDescription("View notification delivery success rates and volume.").addIntegerOption(o=>o.setName("period").setDescription("Reporting window").setRequired(false).addChoices({name:"7 days",value:7},{name:"30 days",value:30},{name:"90 days",value:90})).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-retention").setDescription("Set how long notification delivery history is kept.").addIntegerOption(o=>o.setName("days").setDescription("Retention period").setRequired(true).addChoices({name:"7 days",value:7},{name:"30 days",value:30},{name:"90 days",value:90})).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notification-retry").setDescription("Retry a failed notification by queue ID.").addIntegerOption(o=>o.setName("id").setDescription("ID shown by /notification-failures").setRequired(true).setMinValue(1)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("notify-channel").setDescription("Set the server notification channel.").addChannelOption(o=>o.setName("channel").setDescription("Text channel").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("challenge").setDescription("Create a community challenge.").addStringOption(o=>o.setName("title").setDescription("Challenge title").setRequired(true).setMaxLength(100)).addIntegerOption(o=>o.setName("points").setDescription("Points (1–100)").setMinValue(1).setMaxValue(100)),
new SlashCommandBuilder().setName("challenge-join").setDescription("Join a challenge.").addIntegerOption(o=>o.setName("id").setDescription("Challenge ID").setRequired(true).setMinValue(1)),
new SlashCommandBuilder().setName("challenge-approve").setDescription("Approve a completed challenge entry.").addIntegerOption(o=>o.setName("id").setDescription("Challenge ID").setRequired(true).setMinValue(1)).addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("award-points").setDescription("Award community points.").addUserOption(o=>o.setName("user").setDescription("Member").setRequired(true)).addIntegerOption(o=>o.setName("points").setDescription("Points (-100 to 100)").setRequired(true).setMinValue(-100).setMaxValue(100)).addStringOption(o=>o.setName("reason").setDescription("Reason").setRequired(true).setMaxLength(160)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("reward-add").setDescription("Add a consensual text-only reward idea.").addStringOption(o=>o.setName("title").setDescription("Title").setRequired(true).setMaxLength(60)).addStringOption(o=>o.setName("description").setDescription("Description").setRequired(true).setMaxLength(250)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("punishment-add").setDescription("Add a safe optional challenge consequence.").addStringOption(o=>o.setName("title").setDescription("Title").setRequired(true).setMaxLength(60)).addStringOption(o=>o.setName("description").setDescription("Non-physical, non-financial description").setRequired(true).setMaxLength(250)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("reward-list").setDescription("List reward ideas."),
new SlashCommandBuilder().setName("punishment-list").setDescription("List optional challenge consequences."),
new SlashCommandBuilder().setName("dice").setDescription("Roll a dice.").addIntegerOption(o=>o.setName("sides").setDescription("Sides (2–100)").setMinValue(2).setMaxValue(100)),
new SlashCommandBuilder().setName("keyholder-chat").setDescription("Chat with the optional AI keyholder persona.").addStringOption(o=>o.setName("message").setDescription("Your message").setRequired(true).setMaxLength(700)),
new SlashCommandBuilder().setName("audit").setDescription("Show recent admin and lock actions.").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("configure-roles").setDescription("Configure automatic Chaster role assignment.").addRoleOption(o=>o.setName("wearer").setDescription("Role for members with active wearer locks").setRequired(true)).addRoleOption(o=>o.setName("keyholder").setDescription("Role for members with active keyholder locks").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
new SlashCommandBuilder().setName("sync-roles").setDescription("Refresh your Discord roles from your linked Chaster account."),
new SlashCommandBuilder().setName("session-channel").setDescription("Set the parent channel for private wearer/keyholder sessions.").addChannelOption(o=>o.setName("channel").setDescription("Text channel for private threads").setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
new SlashCommandBuilder().setName("session-invite").setDescription("Invite another linked Chaster member to a private bot-assisted session.").addUserOption(o=>o.setName("user").setDescription("The other participant").setRequired(true))
];
function lockLine(l){const title=String(l.title||"Untitled lock").slice(0,70);let t="time hidden/unavailable";if(l.isAllowedToViewTime!==false&&l.endDate){const s=Math.max(0,Math.floor((new Date(l.endDate).getTime()-Date.now())/1000));t=Math.floor(s/86400)+"d "+Math.floor(s%86400/3600)+"h "+Math.floor(s%3600/60)+"m";}return "• **"+title+"** — "+String(l.status||"unknown")+(l.isFrozen?" · frozen":"")+" · "+t+" · ID: `"+(l._id||l.id)+"`";}
async function accessToken(id){if(!getLinkedAccount(id))throw new Error("Link your Chaster account first with /link-chaster.");const t=await getTokensForDiscordUser(id);if(!t?.access_token)throw new Error("Chaster session expired. Run /link-chaster again.");return t.access_token;}
async function requireConfiguredRole(i,kind){if(!i.guildId)return false;const settings=getRoleSettings().find(x=>x.guild_id===i.guildId);const roleId=kind==="wearer"?settings?.wearer_role_id:settings?.keyholder_role_id;if(!roleId){await i.reply({ephemeral:true,content:"This server has not configured the "+kind+" role yet. An admin must run /configure-roles first."});return false;}const member=i.member?.roles?.cache?i.member:await i.guild.members.fetch(i.user.id);if(!member.roles.cache.has(roleId)){await i.reply({ephemeral:true,content:"This command is available to members with the configured **"+(kind==="wearer"?"Wearer":"Keyholder")+"** role. Your role is updated automatically from Chaster; try /sync-roles if it is missing."});return false;}return true;}
async function buildMemberDashboard(guild,user,isAdmin=false,tab="overview"){
  const member=await guild.members.fetch(user.id);
  const linked=Boolean(getLinkedAccount(user.id));
  const linkHealth=getChasterLinkHealth(user.id);
  const settings=getGuildRoleSettings(guild.id);
  const roleLabel=(roleId)=>{if(!roleId)return "Not configured";const role=guild.roles.cache.get(roleId);return role?role.name+" ("+(member.roles.cache.has(roleId)?"assigned":"not assigned")+")":"Configured role missing";};
  let personalLocks=[],keyholderLocks=[],lockLoadError=!linked?"Link your Chaster account to load live locks.":linkHealth?.status==="needs_reauth"?"Reconnect your Chaster account with /link-chaster to load live locks.":null;
  if(linked&&linkHealth?.status!=="needs_reauth"&&(tab==="overview"||tab==="account")){
    try{
      const token=await accessToken(user.id);
      const [personalRaw,keyholderRaw]=await Promise.all([getMyLocks(token),getKeyholderLocks(token)]);
      const asList=(raw,...keys)=>Array.isArray(raw)?raw:keys.map(key=>raw?.[key]).find(Array.isArray)||[];
      personalLocks=asList(personalRaw,"locks","items","data").filter(lock=>!["ended","unlocked","expired","cancelled"].includes(String(lock.status||"").toLowerCase()));
      keyholderLocks=asList(keyholderRaw,"locks","items","data").filter(lock=>!["ended","unlocked","expired","cancelled"].includes(String(lock.status||"").toLowerCase()));
    }catch(error){
      lockLoadError=error.code==="CHASTER_REAUTH_REQUIRED"?"Chaster requires you to reconnect with /link-chaster.":error.code==="CHASTER_RATE_LIMITED"?"Chaster is rate limiting requests. Try Refresh shortly.":"Live lock data is temporarily unavailable. Try Refresh shortly.";
    }
  }
  const lockSection=(heading,locks)=>heading+"\n"+(locks.length?locks.slice(0,3).map(lockLine).join("\n"):"No active locks returned.");
  const liveLocks=lockLoadError?"**Live lock data**\n"+lockLoadError:
    "**Live Chaster locks**\n"+lockSection("**Wearer locks**",personalLocks)+"\n\n"+lockSection("**Keyholder locks**",keyholderLocks);
  const data=getMemberSessionDashboard(guild.id,user.id);
  const sessions=[];
  for(const session of data.sessions){
    const thread=await guild.channels.fetch(session.thread_id).catch(()=>null);
    if(thread&&!thread.archived)if(sessions.length<5)sessions.push("<#"+session.thread_id+"> · <@"+(session.inviter_id===user.id?session.invitee_id:session.inviter_id)+">");
  }
  const invites=data.invites.slice(0,5).map(inv=>inv.invitee_id===user.id?"Incoming invitation from <@"+inv.inviter_id+"> · expires <t:"+Math.floor(inv.expires_at/1000)+":R>":"Invitation sent to <@"+inv.invitee_id+"> · expires <t:"+Math.floor(inv.expires_at/1000)+":R>");
  const title="**ChasterBot dashboard · "+guild.name+"**";
  const account="**Chaster account**\n"+(linked?"Linked"+(linkHealth?.status==="needs_reauth"?" · **Reconnect required**":" · healthy"):"Not linked · use /link-chaster");
  const roles="**Your server roles**\nWearer: "+roleLabel(settings.wearer_role_id)+"\nKeyholder: "+roleLabel(settings.keyholder_role_id)+"\n\nUse /sync-roles to refresh your Chaster-derived roles.";
  const activity=getMemberSessionActivity(guild.id,user.id,8);
  const eventLabel=(event,actor,other)=>({invited:"<@"+actor+"> invited <@"+other+">",accepted:"<@"+actor+"> accepted <@"+other+">’s invitation",declined:"<@"+actor+"> declined <@"+other+">’s invitation",cancelled:"<@"+actor+"> cancelled an invitation to <@"+other+">",created:"Private session created for <@"+actor+"> and <@"+other+">",closed:"<@"+actor+"> closed the private session with <@"+other+">"}[event]||"Session activity");
  const activityText=activity.length?"\n\n**Recent activity**\n"+activity.map(entry=>"• "+eventLabel(entry.event,entry.actor_id,entry.other_id)+" · <t:"+Math.floor(entry.created_at/1000)+":R>").join("\n"):"\n\nNo session activity yet.";
  const sessionText="**Your private sessions**\n"+(sessions.length?sessions.join("\n"):"No active private sessions found")+(invites.length?"\n\n**Pending invitations**\n"+invites.join("\n"):"\n\nNo pending invitations.")+activityText;
  const adminText="**Server settings**\nSession channel: "+(getSessionChannel(guild.id)?"<#"+getSessionChannel(guild.id)+">":"Not configured")+"\nWearer role: "+(settings.wearer_role_id?"<@&"+settings.wearer_role_id+">":"Not configured")+"\nKeyholder role: "+(settings.keyholder_role_id?"<@&"+settings.keyholder_role_id+">":"Not configured")+"\nRole sync: "+(settings.wearer_role_id||settings.keyholder_role_id?"Configured":"Not configured");
  const commandDirectory=getDashboardCommandGroups(commands.map(command=>command.toJSON().name),{
    hasWearerRole:Boolean(settings.wearer_role_id&&member.roles.cache.has(settings.wearer_role_id)),
    hasKeyholderRole:Boolean(settings.keyholder_role_id&&member.roles.cache.has(settings.keyholder_role_id)),
    canManageGuild:member.permissions.has(PermissionFlagsBits.ManageGuild),
    canManageRoles:member.permissions.has(PermissionFlagsBits.ManageRoles)
  }).map(group=>"**"+group.heading+"**\\n"+group.commands.map(name=>"`/"+name+"`").join(" · ")).join("\\n\\n");
  let body;
  if(tab==="roles")body=roles;
  else if(tab==="sessions")body=sessionText+"\n\nCommands: /session-invite";
  else if(tab==="account")body=account+"\n\n"+liveLocks+"\n\nCommands: /link-chaster · /chaster-link-status · /unlink-chaster";
  else if(tab==="commands")body="**Command directory**\nCommands are shown when your current server permissions and configured roles allow them.\n\n"+(commandDirectory||"No commands available for your current roles and permissions.");
  else if(tab==="admin")body=isAdmin?adminText:"You do not have permission to view server settings.";
  else body="**At a glance**\nAccount: "+(linked?(linkHealth?.status==="needs_reauth"?"Reconnect required":"Linked"):"Not linked")+"\nWearer role: "+(settings.wearer_role_id?(member.roles.cache.has(settings.wearer_role_id)?"Assigned":"Not assigned"):"Not assigned")+(settings.wearer_role_id?"":" · Not configured")+"\nKeyholder role: "+(settings.keyholder_role_id?(member.roles.cache.has(settings.keyholder_role_id)?"Assigned":"Not assigned"):"Not configured")+"\nActive private sessions: "+sessions.length+"\nPending invitations: "+invites.length+"\nActive wearer locks: "+personalLocks.length+"\nActive keyholder locks: "+keyholderLocks.length+(lockLoadError?"\nLock data: unavailable":"")+"\n\nChoose a tab below to see details.";
  return (title+"\n\n"+body+"\n\nPrivate to you · refreshed on demand").slice(0,1950);
}
function buildDashboardComponents(guild,userId,isAdmin,tab="overview"){
  const tabs=[["overview","Overview"],["roles","Roles"],["sessions","Sessions"],["account","Account"],["commands","Commands"]];
  if(isAdmin)tabs.push(["admin","Admin"]);
  const rows=[];
  for(let i=0;i<tabs.length;i+=5)rows.push(new ActionRowBuilder().addComponents(...tabs.slice(i,i+5).map(([key,label])=>new ButtonBuilder().setCustomId("dashboard:"+key+":"+userId).setLabel(label).setStyle(tab===key?ButtonStyle.Primary:ButtonStyle.Secondary))));
  const refresh=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("dashboard:refresh:"+tab+":"+userId).setLabel("Refresh").setStyle(ButtonStyle.Success));
  rows.push(refresh);
  if(tab==="sessions"){
    const data=getMemberSessionDashboard(guild.id,userId);
    const actions=[];
    data.sessions.forEach((session,index)=>actions.push(new ButtonBuilder().setCustomId("dashclose:"+session.thread_id+":"+userId).setLabel("Close session "+(index+1)).setStyle(ButtonStyle.Danger)));
    data.invites.forEach((invite,index)=>actions.push(new ButtonBuilder().setCustomId("dashinvite:"+invite.id+":"+userId).setLabel((invite.inviter_id===userId?"Cancel invite ":"Decline invite ")+(index+1)).setStyle(ButtonStyle.Secondary)));
    for(let i=0;i<actions.length;i+=5)rows.push(new ActionRowBuilder().addComponents(...actions.slice(i,i+5)));
  }
  return rows;
}
export async function handleCommand(i){const n=i.commandName;
if(n==="dashboard"){
if(!i.guild)return i.reply({ephemeral:true,content:"Open the dashboard from a server."});
const admin=Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
const content=await buildMemberDashboard(i.guild,i.user,admin,"overview");
return i.reply({ephemeral:true,content,components:buildDashboardComponents(i.guild,i.user.id,admin,"overview")});
}
if(n==="lock-status"&&!await requireConfiguredRole(i,"wearer"))return;
if((n==="keyholder-locks"||n==="time-change"||n==="keyholder-notes"||n==="keyholder-notes-delete")&&!await requireConfiguredRole(i,"keyholder"))return;
if(n==="keyholder-applications"&&!await requireConfiguredRole(i,"wearer"))return;
if(n==="configure-roles"){const w=i.options.getRole("wearer",true),k=i.options.getRole("keyholder",true);if(w.id===k.id)return i.reply({ephemeral:true,content:"Choose two different roles."});setGuildRoles(i.guildId,w?.id,k?.id,i.user.id);return i.reply({ephemeral:true,content:"Role configuration saved. The bot needs Manage Roles, and both selected roles must be below its highest role."});}
if(n==="sync-roles"){await i.deferReply({ephemeral:true});const result=await syncUserRoles(i.client,i.user.id);return i.editReply(result.message);}
if(n==="session-channel"){const c=i.options.getChannel("channel",true);if(c.type!==ChannelType.GuildText)return i.reply({ephemeral:true,content:"Choose a regular text channel (not a forum or announcement channel)."});setSessionChannel(i.guildId,c.id,i.user.id);return i.reply({ephemeral:true,content:"Private session threads will be created under "+c+"."});}
if(n==="session-invite"){const other=i.options.getUser("user",true);if(other.bot||other.id===i.user.id)return i.reply({ephemeral:true,content:"Choose another human member."});if(!getLinkedAccount(i.user.id)||!getLinkedAccount(other.id))return i.reply({ephemeral:true,content:"Both participants must link their Chaster accounts first using /link-chaster."});const parent=getSessionChannel(i.guildId);if(!parent)return i.reply({ephemeral:true,content:"An admin must configure a session channel with /session-channel first."});const channel=await i.guild.channels.fetch(parent).catch(()=>null);if(!channel||channel.type!==ChannelType.GuildText)return i.reply({ephemeral:true,content:"The configured session channel is unavailable."});const id=randomUUID();createSessionInvite(id,i.guildId,parent,i.user.id,other.id,Date.now()+600000);recordSessionActivity(i.guildId,i.user.id,other.id,"invited",{inviteId:id});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("session-accept:"+id).setLabel("Accept private session").setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId("session-decline:"+id).setLabel("Decline").setStyle(ButtonStyle.Secondary));const dm=await other.send({content:"<@"+i.user.id+"> invited you to a private ChasterBot session in **"+i.guild.name+"**. Both of you must have linked Chaster accounts. This invitation expires in 10 minutes.",components:[row]}).catch(()=>null);if(!dm)return i.reply({ephemeral:true,content:"I could not DM that member. They may need to enable server-member DMs before you can invite them."});return i.reply({ephemeral:true,content:"Invitation sent by DM to "+other.username+". They must accept before a private thread is created."});}
if(n==="help")return i.reply({ephemeral:true,content:"**ChasterBot Enhanced**\n/link-chaster · /chaster-link-status · /unlink-chaster · /lock-status · /keyholder-locks · /time-change\n/chaster-profile · /shared-locks · /chaster-conversations · /chaster-calendar · /chaster-notifications\n/lock-details · /lock-seal · /keyholder-notes · /keyholder-notes-delete · /chaster-settings · /permission-catalog\n/chaster-user-overview · /chaster-user-stats · /chaster-achievements · /chaster-badges · /lock-history · /keyholder-applications\n/chaster-conversation · /chaster-messages · /shared-lock-favorite · /shared-lock-favorite-add · /shared-lock-favorite-remove · /chaster-notification-health · /chaster-notification-read · /chaster-notifications-read-all\n/shared-lock-details · /shared-lock-archive · /shared-lock-tags · /chaster-extensions · /chaster-explore-categories · /chaster-calendar-stats · /chaster-blocks\n/chaster-achievement-categories · /chaster-ignored-users · /chaster-lock-stats-config · /chaster-community-categories\n/chaster-public-locks\n/calendar-event-add · /calendar-event-edit · /calendar-event-delete\n/notifications · /profile · /leaderboard · /award-points\n/challenge · /challenge-join · /challenge-approve\n/reward-add · /punishment-add · /reward-list · /punishment-list\n/dice · /keyholder-chat · /notify-channel · /audit\n/dashboard · /configure-roles · /sync-roles · /session-channel · /session-invite\nLock changes always require a linked keyholder, a verified keyheld lock, a 24-hour per-command bound and explicit confirmation."});
if(n==="link-chaster")return i.reply({ephemeral:true,content:"Authorize Chaster using this private link (expires in 10 minutes):\n"+createAuthorizationUrl(i.user.id)});
if(n==="chaster-link-status"){const linked=getLinkedAccount(i.user.id);if(!linked)return i.reply({ephemeral:true,content:"No Chaster account is linked. Run /link-chaster to connect one."});const health=getChasterLinkHealth(i.user.id);if(health?.status==="needs_reauth")return i.reply({ephemeral:true,content:"Your Chaster connection needs attention. Chaster rejected its authorization, or its refresh token was revoked. Run /link-chaster and approve access again. Your existing bot data is unchanged."});return i.reply({ephemeral:true,content:"Your Chaster account is linked and has no recorded authorization errors. If a Chaster command fails, try again or check Chaster service status."});}
if(n==="unlink-chaster"){deleteLinkedAccount(i.user.id);return i.reply({ephemeral:true,content:"Your saved Chaster connection and local lock snapshots have been deleted."});}
if(n==="profile"){const p=ensureProfile(i.user);return i.reply({ephemeral:true,content:"**"+p.display_name+"**\nPoints: **"+p.points+"**\nChaster: "+(getLinkedAccount(i.user.id)?"linked":"not linked")});}
if(n==="leaderboard"){const a=leaderboard(10);return i.reply(a.length?"**Community leaderboard**\n"+a.map((x,k)=>(k+1)+". **"+x.display_name+"** — "+x.points+" pts").join("\n"):"No profiles yet.");}
if(n==="chaster-profile"||n==="shared-locks"||n==="chaster-conversations"||n==="chaster-calendar"||n==="chaster-notifications"){
await i.deferReply({ephemeral:true});
const token=await accessToken(i.user.id);
const list=(raw,...keys)=>Array.isArray(raw)?raw:keys.map(k=>raw?.[k]).find(Array.isArray)||[];
if(n==="chaster-profile"){const p=await getCurrentProfile(token);return i.editReply("**Chaster profile**\nUsername: "+String(p.username||"Unavailable")+"\nUser ID: "+String(p.id||p._id||"unknown"));}
if(n==="shared-locks"){const raw=await getSharedLocks(token),a=list(raw,"items","locks","sharedLocks","data");return i.editReply(a.length?"**Your shared locks**\n"+a.slice(0,15).map(x=>"• **"+String(x.title||x.name||"Shared lock").slice(0,65)+"** · "+String(x.status||"unknown")+" · ID: "+String(x._id||x.id||"unknown")).join("\n"):"No shared locks returned.");}
if(n==="chaster-conversations"){const raw=await getConversations(token),a=list(raw,"items","conversations","data");return i.editReply(a.length?"**Your Chaster conversations**\n"+a.slice(0,15).map(x=>"• "+String(x.title||x.name||x.user?.username||x.participant?.username||"Conversation").slice(0,75)+" · ID: "+String(x._id||x.id||"unknown")).join("\n"):"No conversations returned.");}
if(n==="chaster-calendar"){const raw=await getCalendarEvents(token),a=list(raw,"items","events","data");return i.editReply(a.length?"**Your Chaster calendar**\n"+a.slice(0,15).map(x=>"• **"+String(x.title||x.name||x.type||"Event").slice(0,65)+"** · "+String(x.startDate||x.start||x.date||"date unavailable")).join("\n"):"No calendar events returned.");}
const raw=await getNotificationCounts(token);return i.editReply("**Chaster notification counts**\n"+JSON.stringify(raw).slice(0,1400));
}
if(n==="keyholder-notes-delete"){const lockId=i.options.getString("lock_id",true),id=randomUUID();pending.set(id,{user:i.user.id,lockId,created:Date.now(),kind:"keyholder-note-delete",guildId:i.guildId});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("knd:"+id).setLabel("Confirm delete notes").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("knx:"+id).setLabel("Cancel").setStyle(ButtonStyle.Secondary));return i.reply({ephemeral:true,content:"Delete your private Chaster keyholder notes for lock "+lockId+"? This cannot be undone.",components:[row]});}
if(n==="lock-details"||n==="lock-seal"||n==="keyholder-notes"||n==="chaster-settings"||n==="permission-catalog"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);let raw;
if(n==="lock-details")raw=await getLockDetails(i.options.getString("lock_id",true),token);
else if(n==="lock-seal")raw=await getLockSeal(i.options.getString("lock_id",true),token);
else if(n==="keyholder-notes")raw=await getKeyholderNotes(i.options.getString("lock_id",true),token);
else if(n==="chaster-settings")raw=await getChasterSettings(token);
else raw=await getPermissionDefinitions(token);
const out=JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\n```json\n"+out.replace(/@/g,"＠").slice(0,1750)+"\n```");
}
if(n==="chaster-user-overview"||n==="chaster-user-stats"||n==="chaster-achievements"||n==="chaster-badges"||n==="lock-history"||n==="keyholder-applications"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);let raw;
if(n==="chaster-user-overview")raw=await getUserProfileOverview(i.options.getString("username",true),token);
else if(n==="chaster-user-stats")raw=await getUserProfileStatistics(i.options.getString("username",true),token);
else if(n==="chaster-achievements"){const p=await getCurrentProfile(token);raw=await getUserAchievements(String(p.id||p._id),token);}
else if(n==="chaster-badges")raw=await getUserBadgeCount(token);
else if(n==="lock-history")raw=await getLockHistory(i.options.getString("lock_id",true),token);
else raw=await getKeyholderApplications(i.options.getString("lock_id",true),token);
const out=JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\n```json\n"+out.replace(/@/g,"＠").slice(0,1750)+"\n```");
}
if(n==="shared-lock-favorite-add"||n==="shared-lock-favorite-remove"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id),sharedLockId=i.options.getString("shared_lock_id",true);
if(n==="shared-lock-favorite-add")await addSharedLockFavorite(sharedLockId,token);else await removeSharedLockFavorite(sharedLockId,token);
return i.editReply(n==="shared-lock-favorite-add"?"Chaster accepted the shared-lock favorite.":"Chaster accepted removal of the shared-lock favorite.");
}
if(n==="chaster-conversation"||n==="chaster-messages"||n==="shared-lock-favorite"||n==="chaster-notification-health"||n==="chaster-notification-read"||n==="chaster-notifications-read-all"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);let raw;
if(n==="chaster-conversation")raw=await getConversation(i.options.getString("conversation_id",true),token);
else if(n==="chaster-messages")raw=await getConversationMessages(i.options.getString("conversation_id",true),token);
else if(n==="shared-lock-favorite")raw=await getSharedLockFavorite(i.options.getString("shared_lock_id",true),token);
else if(n==="chaster-notification-health")raw=await getNotificationChannelHealth(token);
else if(n==="chaster-notification-read")raw=await markNotificationRead(i.options.getString("notification_id",true),token);
else raw=await markAllNotificationsRead(token);
const out=raw===null?"Action completed.":JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\\n```json\\n"+out.replace(/@/g,"＠").slice(0,1750)+"\\n```");
}
if(n==="shared-lock-details"||n==="shared-lock-tags"||n==="chaster-extensions"||n==="chaster-explore-categories"||n==="chaster-calendar-stats"||n==="chaster-blocks"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);let raw;
if(n==="shared-lock-details")raw=await getSharedLockDetails(i.options.getString("shared_lock_id",true),token);
else if(n==="shared-lock-tags")raw=await getSharedLockTags(token);
else if(n==="chaster-extensions")raw=await getExtensions(token);
else if(n==="chaster-explore-categories")raw=await getExploreCategories(token);
else if(n==="chaster-calendar-stats")raw=await getCalendarStatistics(token);
else raw=await getBlockedUsers(token);
const out=JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\\n```json\\n"+out.replace(/@/g,"＠").slice(0,1750)+"\\n```");
}
if(n==="chaster-achievement-categories"||n==="chaster-ignored-users"||n==="chaster-lock-stats-config"||n==="chaster-community-categories"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);let raw;
if(n==="chaster-achievement-categories")raw=await getAchievementCategories(token);
else if(n==="chaster-ignored-users")raw=await getIgnoredUsers(token);
else if(n==="chaster-lock-stats-config")raw=await getLockStatsResetConfig(token);
else if(n==="chaster-community-categories")raw=await getCommunityEventCategories(token);

const out=JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\\n```json\\n"+out.replace(/@/g,"＠").slice(0,1750)+"\\n```");
}
if(n==="chaster-public-locks"){
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);
const raw=await getPublicLocks(i.options.getString("user_id",true),token);
const out=JSON.stringify(raw,null,2)||"No data returned.";return i.editReply("**"+n+"**\\n```json\\n"+out.replace(/@/g,"＠").slice(0,1750)+"\\n```");
}
if(n==="calendar-event-add"){
const start=i.options.getString("start_date",true),end=i.options.getString("end_date"),allDay=i.options.getBoolean("all_day"),description=i.options.getString("description");
const startDate=new Date(start);const endDate=end?new Date(end):null;
if(!Number.isFinite(startDate.getTime())||(end&&(!Number.isFinite(endDate.getTime())||endDate<=startDate)))return i.reply({ephemeral:true,content:"Use valid ISO 8601 dates; the optional end must be later than the start."});
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);
const data={type:"lock_period",startDate:startDate.toISOString(),...(endDate?{endDate:endDate.toISOString()}:{}),...(allDay!==null?{isAllDay:allDay}:{}),...(description!==null?{description}: {})};
const raw=await createCalendarEvent(data,token);return i.editReply("Chaster calendar event created.\n"+JSON.stringify(raw).slice(0,1200));
}
if(n==="calendar-event-edit"){
const eventId=i.options.getString("event_id",true),start=i.options.getString("start_date"),end=i.options.getString("end_date"),allDay=i.options.getBoolean("all_day"),description=i.options.getString("description");
if(start===null&&end===null&&allDay===null&&description===null)return i.reply({ephemeral:true,content:"Provide at least one field to change."});
const data={};if(start!==null){const d=new Date(start);if(!Number.isFinite(d.getTime()))return i.reply({ephemeral:true,content:"Start date must be valid ISO 8601."});data.startDate=d.toISOString();}
if(end!==null){const d=new Date(end);if(!Number.isFinite(d.getTime()))return i.reply({ephemeral:true,content:"End date must be valid ISO 8601."});data.endDate=d.toISOString();}
if(data.startDate&&data.endDate&&new Date(data.endDate)<=new Date(data.startDate))return i.reply({ephemeral:true,content:"End date must be later than start date."});
if(allDay!==null)data.isAllDay=allDay;if(description!==null)data.description=description;
await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);const raw=await updateCalendarEvent(eventId,data,token);return i.editReply("Chaster calendar event updated.\n"+JSON.stringify(raw).slice(0,1200));
}
if(n==="shared-lock-archive"){
const sharedLockId=i.options.getString("shared_lock_id",true);await i.deferReply({ephemeral:true});
const token=await accessToken(i.user.id),owned=await getSharedLocks(token);
if(!isOwnedResourceListed(owned,sharedLockId,["items","locks","sharedLocks","data"],"_id","id"))return i.editReply("That shared lock was not found in your own Chaster shared-lock list. No archive request was made.");
const id=randomUUID();pending.set(id,{user:i.user.id,sharedLockId,created:Date.now(),kind:"shared-lock-archive"});
const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("sa:"+id).setLabel("Confirm archive").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("sx:"+id).setLabel("Cancel").setStyle(ButtonStyle.Secondary));
return i.editReply({content:"Archive your Chaster shared lock "+sharedLockId+"? This may hide it from active shared-lock listings.",components:[row]});
}
if(n==="calendar-event-delete"){
const eventId=i.options.getString("event_id",true);await i.deferReply({ephemeral:true});
const token=await accessToken(i.user.id),owned=await getCalendarEvents(token);
if(!isOwnedResourceListed(owned,eventId,["items","events","data"],"_id","id","eventId","event_id"))return i.editReply("That event was not found in your own Chaster calendar. No deletion request was made.");
const id=randomUUID();pending.set(id,{user:i.user.id,eventId,created:Date.now(),kind:"calendar-delete"});
const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cd:"+id).setLabel("Confirm delete").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("cx:"+id).setLabel("Cancel").setStyle(ButtonStyle.Secondary));
return i.editReply({content:"Delete your Chaster calendar event "+eventId+"? This cannot be undone.",components:[row]});
}
if(n==="lock-status"||n==="keyholder-locks"){await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);const raw=n==="lock-status"?await getMyLocks(token):await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);return i.editReply(a.length?(n==="lock-status"?"**Your Chaster locks**\n":"**Locks you keyhold**\n")+a.slice(0,15).map(lockLine).join("\n"):"No locks returned for this account.");}
if(n==="time-change"){const lockId=i.options.getString("lock_id",true),seconds=i.options.getInteger("seconds",true),reason=i.options.getString("reason",true);if(!seconds)return i.reply({ephemeral:true,content:"Seconds must be non-zero."});await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);const raw=await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);const lock=a.find(x=>String(x._id||x.id)===lockId);if(!lock)return i.editReply("That lock is not in your Chaster keyholder lock list. No change made.");if(lock.trusted!==true||lock.role!=="keyholder")return i.editReply("Chaster did not confirm a trusted keyholder role for this lock. No change made.");const nonce=randomUUID();pending.set(nonce,{user:i.user.id,lockId,seconds,reason,guildId:i.guildId,kind:"time-change",created:Date.now()});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("tc:"+nonce).setLabel("Confirm time change").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("tx:"+nonce).setLabel("Cancel").setStyle(ButtonStyle.Secondary));return i.editReply({content:"**Confirm Chaster time change**\n"+String(lock.title||lockId)+"\n"+(seconds>0?"Add ":"Remove ")+Math.abs(seconds)+" seconds\nReason: "+reason+"\nNo change occurs unless you press Confirm.",components:[row]});}
if(n==="notifications"){const on=i.options.getBoolean("enabled",true);setNotificationOptIn(i.guildId,i.user.id,on);return i.reply({ephemeral:true,content:on?"Lock updates are resumed for you in this server.":"Lock updates are paused for you in this server."});}
if(n==="notification-status"){const enabled=getNotificationPreference(i.guildId,i.user.id),channelId=getNotificationChannel(i.guildId);return i.reply({ephemeral:true,content:"**Your lock-update settings**\\nStatus: "+(enabled?"On":"Paused") + "\\nNotification channel: "+(channelId?"< #"+channelId+" >".replace(/ /g,""):"Not configured")+"\\nUse /notifications enabled:true or false to change your preference."});}
if(n==="notification-queue-status"){const q=getDiscordNotificationQueueStats(i.guildId);return i.reply({ephemeral:true,content:"**Notification delivery queue**\\nPending: "+q.pending+"\\nSent: "+q.sent+"\\nFailed: "+q.failed+"\\nMessage contents and recipient details are not exposed."});}
if(n==="notification-health"){const channelId=getNotificationChannel(i.guildId),q=getDiscordNotificationQueueStats(i.guildId),pause=getNotificationChannelPause(i.guildId);if(!channelId)return i.reply({ephemeral:true,content:"**Notification health: not configured**\\nNo notification channel is set. Use /notify-channel to choose one."});let channel=null;try{channel=await i.guild.channels.fetch(channelId);}catch{}if(!channel||!channel.isTextBased())return i.reply({ephemeral:true,content:"**Notification health: channel unavailable**\\nThe configured channel cannot be found or is not a text channel. Choose a replacement with /notify-channel.\\nQueue: "+q.pending+" pending · "+q.failed+" failed."});let botMember=i.guild.members.me; if(!botMember)botMember=await i.guild.members.fetchMe().catch(()=>null);const perms=botMember?channel.permissionsFor(botMember):null;const canView=Boolean(perms?.has(PermissionFlagsBits.ViewChannel)),canSend=Boolean(perms?.has(PermissionFlagsBits.SendMessages));const status=canView&&canSend?"Access permissions look good":!canView?"Bot is missing View Channel":"Bot is missing Send Messages";const pauseStatus=pause&&pause.channel_id===channelId?"\\n<Paused> Automatic notifications are paused after repeated delivery failures ("+pause.reason+"). Run /notify-channel to re-enable this channel or choose another.":"";return i.reply({ephemeral:true,content:"**Notification channel health**\\nChannel: <#"+channelId+">\\n"+status+pauseStatus+"\\nQueue: "+q.pending+" pending · "+q.failed+" failed.\\nThis checks configured channel access and permissions; it does not send a test message or guarantee Discord delivery."});}
if(n==="notification-retention"){
const days=i.options.getInteger("days",true);
setNotificationRetentionDays(i.guildId,days,i.user.id);
return i.reply({ephemeral:true,content:"Notification delivery history will be retained for "+days+" days. Sent and failed channel records older than this period are removed during queue cleanup. Pending notifications are not deleted."});
}
if(n==="notification-report"){
const days=i.options.getInteger("period")??7;
const r=getDiscordNotificationDeliveryReport(i.guildId,days);
const rate=r.successRate===null?"Not available (no completed deliveries)":r.successRate+"%";
const avg=r.completed?r.averageAttempts.toFixed(2):"—";
return i.reply({ephemeral:true,content:"**Notification delivery report · last "+days+" days**\\nSuccess rate: **"+rate+"**\\nSent: "+r.sent+" · Failed: "+r.failed+" · Pending: "+r.pending+"\\nAverage attempts per completed delivery: "+avg+"\\nSuccess rate counts sent vs. failed deliveries; pending items are excluded. Results are limited to records still within your configured retention period. No message contents or destination IDs are shown."});
}
if(n==="notification-history"){

const rows=getDiscordNotificationHistory(i.guildId,10);
if(!rows.length)return i.reply({ephemeral:true,content:"No notification delivery history is available for this server yet."});
const reason=e=>{const s=String(e||"").toLowerCase();if(!s)return "";if(s.includes("50007")||s.includes("cannot send messages to this user"))return "Recipient cannot receive DMs";if(s.includes("10003")||s.includes("unknown channel"))return "Notification channel unavailable";if(s.includes("50001")||s.includes("50013")||s.includes("missing permissions"))return "Bot lacks channel permissions";if(s.includes("429")||s.includes("rate limit"))return "Rate limited";return "Discord delivery error";};
const date=v=>v?new Date(v).toISOString().replace("T"," ").slice(0,19)+" UTC":"—";
const lines=rows.map(x=>{const state=x.status==="sent"?"Sent":x.status==="failed"?"Failed":"Pending";return "#"+x.id+" · "+state+" · attempts "+x.attempts+" · queued "+date(x.created_at)+(x.sent_at?" · sent "+date(x.sent_at):"")+(x.status==="failed"?" · "+reason(x.last_error):"");});
return i.reply({ephemeral:true,content:"**Recent notification deliveries**\\n"+lines.join("\\n")+"\\nShowing up to 10 recent channel notifications. Message contents and recipient/channel IDs are hidden."});
}
if(n==="notification-failures"){const rows=getFailedDiscordNotifications(i.guildId,5);if(!rows.length)return i.reply({ephemeral:true,content:"There are no failed channel notifications for this server."});const reason=e=>{const s=String(e||"").toLowerCase();if(s.includes("50007")||s.includes("cannot send messages to this user"))return "Recipient cannot receive DMs";if(s.includes("10003")||s.includes("unknown channel"))return "Notification channel no longer exists";if(s.includes("50001")||s.includes("50013")||s.includes("missing permissions"))return "Bot lacks required channel permissions";return "Discord delivery failed"};const lines=rows.map(x=>"ID "+x.id+" · attempts: "+x.attempts+" · "+reason(x.last_error));return i.reply({ephemeral:true,content:"**Recent failed notifications**\\n"+lines.join("\\n")+"\\nUse /notification-retry with an ID to retry. Message contents and recipient/channel IDs are hidden."});}
if(n==="notification-retry"){const id=i.options.getInteger("id",true);const ok=retryFailedDiscordNotification(id,i.guildId);return i.reply({ephemeral:true,content:ok?"Notification "+id+" has been requeued. The worker will retry it shortly.":"That failed notification was not found for this server, is not eligible for retry, or has already been retried."});}
if(n==="notify-channel"){const c=i.options.getChannel("channel",true);if(!c.isTextBased())return i.reply({ephemeral:true,content:"Choose a text channel."});setNotificationChannel(i.guildId,c.id,i.user.id);return i.reply({ephemeral:true,content:"Notification channel saved. Members must opt in with /notifications."});}
if(n==="challenge"){const id=createChallenge(i.guildId,i.options.getString("title",true),i.options.getInteger("points")??10,i.user.id);return i.reply("Challenge **#"+id+"** created. Members can join with /challenge-join.");}
if(n==="challenge-join")return i.reply({ephemeral:true,content:joinChallenge(i.options.getInteger("id",true),i.user.id)?"You joined. Ask an admin to verify completion.":"Challenge not found or inactive."});
if(n==="challenge-approve"){const u=i.options.getUser("user",true),p=approveChallenge(i.options.getInteger("id",true),u.id,i.user.id,i.guildId);return i.reply({ephemeral:true,content:p===null?"No pending entry found.":"Approved; awarded "+p+" points to "+u.username+"."});}
if(n==="award-points"){const u=i.options.getUser("user",true),p=i.options.getInteger("points",true),r=i.options.getString("reason",true);addPoints(u.id,u.username,p);audit(i.guildId,i.user.id,"points_awarded",u.id+" "+p+" points: "+r);return i.reply({ephemeral:true,content:"Updated "+u.username+"'s score by "+p+" points."});}
if(n==="reward-add"||n==="punishment-add"){const k=n==="reward-add"?"reward":"punishment";addRewardItem(i.guildId,k,i.options.getString("title",true),i.options.getString("description",true),i.user.id);return i.reply({ephemeral:true,content:"Saved "+k+". Items are suggestions only and require participant agreement."});}
if(n==="reward-list"||n==="punishment-list"){const k=n==="reward-list"?"reward":"punishment",a=listRewardItems(i.guildId,k);return i.reply(a.length?"**"+k+" ideas**\n"+a.map(x=>"#"+x.id+" **"+x.title+"** — "+x.description).join("\n"):"No "+k+" ideas saved.");}
if(n==="dice"){const sides=i.options.getInteger("sides")??6;return i.reply("🎲 "+i.user.username+" rolled **"+(Math.floor(Math.random()*sides)+1)+"** (d"+sides+").");}
if(n==="keyholder-chat"){await i.deferReply();return i.editReply(await keyholderReply(i.options.getString("message",true),i.user.username));}
if(n==="audit"){const a=recentAudit(i.guildId,10);return i.reply({ephemeral:true,content:a.length?a.map(x=>"• <t:"+Math.floor(new Date(x.created_at+" UTC").getTime()/1000)+":R> <@"+x.actor_id+"> — "+x.action+": "+x.details).join("\n"):"No audit entries yet."});}
}
async function sendDashboardSessionInvite(i,rawMemberId){
  const memberId=String(rawMemberId||'').replaceAll('<','').replaceAll('>','').replaceAll('@','').replaceAll('!','').trim();
  if(memberId.length<15||memberId.length>22||![...memberId].every(ch=>ch>='0'&&ch<='9'))throw new Error('Enter a valid Discord member ID or mention.');
  if(memberId===i.user.id)throw new Error('You cannot invite yourself.');
  const other=await i.guild.members.fetch(memberId).catch(()=>null);
  if(!other||other.user.bot)throw new Error('Choose another human member of this server.');
  if(!getLinkedAccount(i.user.id)||!getLinkedAccount(other.id))throw new Error('Both participants must link their Chaster accounts first using /link-chaster.');
  const parent=getSessionChannel(i.guildId);
  if(!parent)throw new Error('An admin must configure a session channel first. An admin can do this in the Admin dashboard.');
  const channel=await i.guild.channels.fetch(parent).catch(()=>null);
  if(!channel||channel.type!==ChannelType.GuildText)throw new Error('The configured session channel is unavailable.');
  const id=randomUUID();
  createSessionInvite(id,i.guildId,parent,i.user.id,other.id,Date.now()+600000);
  const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('session-accept:'+id).setLabel('Accept private session').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('session-decline:'+id).setLabel('Decline').setStyle(ButtonStyle.Secondary));
  const dm=await other.send({content:'<@'+i.user.id+'> invited you to a private ChasterBot session in **'+i.guild.name+'**. Both of you must have linked Chaster accounts. This invitation expires in 10 minutes.',components:[row],allowedMentions:{users:[i.user.id]}}).catch(()=>null);
  if(!dm){deleteSessionInvite(id,i.guildId,i.user.id);throw new Error('I could not DM that member. They may need to enable server-member DMs.');}
  recordSessionActivity(i.guildId,i.user.id,other.id,'invited',{inviteId:id});
  return 'Invitation sent by DM to '+other.user.username+'. It expires in 10 minutes.';
}
export async function handleButton(i){
if(i.customId.startsWith('dashsessioninvite:')){
  const userId=i.customId.split(':')[1];
  if(userId!==i.user.id){await i.reply({ephemeral:true,content:'This dashboard belongs to another member.'});return true;}
  if(!i.guild){await i.reply({ephemeral:true,content:'Open the dashboard from a server.'});return true;}
  const modal=new ModalBuilder().setCustomId('dashsessioninvite-submit:'+userId).setTitle('Invite a session participant');
  const memberInput=new TextInputBuilder().setCustomId('member_id').setLabel('Discord member ID or @mention').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setPlaceholder('123456789012345678');
  modal.addComponents(new ActionRowBuilder().addComponents(memberInput));
  await i.showModal(modal);
  return true;
}

if(i.customId.startsWith("dashclose:")){
const [,threadId,userId]=i.customId.split(":");
if(userId!==i.user.id){await i.reply({ephemeral:true,content:"This dashboard belongs to another member."});return true;}
if(!i.guild){await i.reply({ephemeral:true,content:"Open the dashboard from a server."});return true;}
const owned=getMemberSessionDashboard(i.guild.id,i.user.id).sessions.some(session=>session.thread_id===threadId);
if(!owned){await i.reply({ephemeral:true,content:"That session is not available to you."});return true;}
const thread=await i.guild.channels.fetch(threadId).catch(()=>null);
if(!thread||!thread.isThread?.()){await i.reply({ephemeral:true,content:"The session thread could not be found."});return true;}
if(thread.archived){const session=getMemberSessionDashboard(i.guild.id,i.user.id).sessions.find(item=>item.thread_id===threadId);if(session)recordSessionActivity(i.guild.id,i.user.id,session.inviter_id===i.user.id?session.invitee_id:session.inviter_id,"closed",{threadId});deletePrivateSession(i.guild.id,threadId,i.user.id);await i.update({content:await buildMemberDashboard(i.guild,i.user,Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)),"sessions"),components:buildDashboardComponents(i.guild,i.user.id,Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)),"sessions")});return true;}
try{
await thread.setArchived(true,"Closed by a session participant");
const session=getMemberSessionDashboard(i.guild.id,i.user.id).sessions.find(item=>item.thread_id===threadId);if(session)recordSessionActivity(i.guild.id,i.user.id,session.inviter_id===i.user.id?session.invitee_id:session.inviter_id,"closed",{threadId});
deletePrivateSession(i.guild.id,threadId,i.user.id);
const admin=Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
await i.update({content:"Session closed and archived.\n\n"+await buildMemberDashboard(i.guild,i.user,admin,"sessions"),components:buildDashboardComponents(i.guild,i.user.id,admin,"sessions")});
}catch(error){await i.reply({ephemeral:true,content:"I couldn't archive that session. Check the bot's Manage Threads permission."});}
return true;
}
if(i.customId.startsWith("dashinvite:")){
const [,inviteId,userId]=i.customId.split(":");
if(userId!==i.user.id){await i.reply({ephemeral:true,content:"This dashboard belongs to another member."});return true;}
if(!i.guild){await i.reply({ephemeral:true,content:"Open the dashboard from a server."});return true;}
const invite=getMemberSessionDashboard(i.guild.id,i.user.id).invites.find(item=>item.id===inviteId);if(!invite||!deleteSessionInvite(inviteId,i.guild.id,i.user.id)){await i.reply({ephemeral:true,content:"That invitation has expired or is no longer available."});return true;}
recordSessionActivity(i.guild.id,i.user.id,invite.inviter_id===i.user.id?invite.invitee_id:invite.inviter_id,invite.inviter_id===i.user.id?"cancelled":"declined",{inviteId});
const admin=Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
await i.update({content:"Invitation cancelled.\n\n"+await buildMemberDashboard(i.guild,i.user,admin,"sessions"),components:buildDashboardComponents(i.guild,i.user.id,admin,"sessions")});
return true;
}
if(i.customId.startsWith("dashboard:")){
const parts=i.customId.split(":");
const action=parts[1],tab=action==="refresh"?parts[2]:action,userId=action==="refresh"?parts[3]:parts[2];
if(userId!==i.user.id){await i.reply({ephemeral:true,content:"This dashboard belongs to another member."});return true;}
if(!i.guild){await i.reply({ephemeral:true,content:"Open the dashboard from a server."});return true;}
const admin=Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
const allowedTabs=["overview","roles","sessions","account","commands","admin"];
const selected=allowedTabs.includes(tab)?tab:"overview";
if(selected==="admin"&&!admin){await i.reply({ephemeral:true,content:"You need Manage Server to view this tab."});return true;}
const content=await buildMemberDashboard(i.guild,i.user,admin,selected);
await i.update({content,components:buildDashboardComponents(i.guild,i.user.id,admin,selected)});
return true;
}

if(i.customId.startsWith("session-accept:")||i.customId.startsWith("session-decline:")){const [action,id]=i.customId.split(":");const inv=consumeSessionInvite(id,i.user.id);if(!inv||inv.invitee_id!==i.user.id){await i.reply({ephemeral:true,content:"This invitation expired or is not addressed to you."});return true;}if(action==="session-decline"){recordSessionActivity(inv.guild_id,i.user.id,inv.inviter_id,"declined",{inviteId:id});await i.update({content:"You declined the private session invitation.",components:[]});return true;}const guild=await i.client.guilds.fetch(inv.guild_id).catch(()=>null);if(!guild){await i.update({content:"The server is unavailable.",components:[]});return true;}const parent=await guild.channels.fetch(inv.channel_id).catch(()=>null);if(!parent||parent.type!==ChannelType.GuildText){await i.update({content:"The configured session channel is unavailable.",components:[]});return true;}try{const inviter=await guild.members.fetch(inv.inviter_id),invitee=await guild.members.fetch(inv.invitee_id);const thread=await parent.threads.create({name:("Chaster · "+inviter.user.username+" + "+invitee.user.username).slice(0,100),autoArchiveDuration:1440,type:ChannelType.PrivateThread,invitable:false,reason:"Mutual opt-in ChasterBot session"});await thread.members.add(inv.inviter_id);await thread.members.add(inv.invitee_id);recordPrivateSession(id,inv.guild_id,thread.id,inv.inviter_id,inv.invitee_id);recordSessionActivity(inv.guild_id,i.user.id,inv.inviter_id,"accepted",{inviteId:id,threadId:thread.id});recordSessionActivity(inv.guild_id,inv.inviter_id,i.user.id,"created",{inviteId:id,threadId:thread.id});await thread.send({content:"Welcome to your private ChasterBot session. Participants: <@"+inv.inviter_id+"> and <@"+inv.invitee_id+">. The bot can help with lock status, optional challenges and coordination. Both participants can leave at any time. Do not share passwords or access tokens here.",allowedMentions:{users:[inv.inviter_id,inv.invitee_id]}});await i.update({content:"You accepted. Your private session thread has been created: "+thread.toString(),components:[]});await inviter.send("Your ChasterBot session with "+invitee.user.username+" is ready: "+thread.toString()).catch(()=>{});}catch(e){console.error("Private session creation failed:",e.message);await i.update({content:"Could not create the private thread. Ask a server admin to check the bot's Create Private Threads, Manage Threads and Send Messages in Threads permissions.",components:[]});}return true;}
if(i.customId.startsWith("knd:")||i.customId.startsWith("knx:")){
const [action,id]=i.customId.split(":");const result=consumeConfirmation(pending,id,i.user.id,"keyholder-note-delete",action,"knd","knx");const p=result.entry;
if(result.status==="invalid"){await i.reply({ephemeral:true,content:"This confirmation expired or belongs to another user."});return true;}
if(result.status==="expired"){await i.update({content:"Confirmation expired. No notes were deleted.",components:[]});return true;}
if(result.status==="cancelled"){await i.update({content:"Cancelled. Your keyholder notes were not changed.",components:[]});return true;}
const roleSettings=getRoleSettings().find(x=>x.guild_id===p.guildId);const keyholderRoleId=roleSettings?.keyholder_role_id;const member=await i.guild?.members.fetch(i.user.id).catch(()=>null);
if(!keyholderRoleId||!member?.roles.cache.has(keyholderRoleId)){await i.update({content:"Your Keyholder role is no longer present. No notes were deleted.",components:[]});return true;}
await i.update({content:"Rechecking keyholder access before deleting notes…",components:[]});
try{const token=await accessToken(i.user.id);const raw=await getKeyholderLocks(token);const locks=Array.isArray(raw)?raw:(raw?.locks||[]);const lock=locks.find(x=>String(x._id||x.id)===p.lockId);if(!lock||lock.trusted!==true||lock.role!=="keyholder")throw new Error("Keyholder authorization, role or trust check failed.");await deleteKeyholderNotes(p.lockId,token);await i.followUp({ephemeral:true,content:"Chaster accepted the keyholder-note deletion request."});}
catch(e){await i.followUp({ephemeral:true,content:"Chaster did not confirm note deletion: "+e.message});}
return true;
}
if(i.customId.startsWith("sa:")||i.customId.startsWith("sx:")){
const [action,id]=i.customId.split(":");const result=consumeConfirmation(pending,id,i.user.id,"shared-lock-archive",action,"sa","sx");const p=result.entry;
if(result.status==="invalid"){await i.reply({ephemeral:true,content:"This confirmation expired or belongs to another user."});return true;}
if(result.status==="expired"){await i.update({content:"Confirmation expired. The shared lock was not archived.",components:[]});return true;}
if(result.status==="cancelled"){await i.update({content:"Cancelled. The shared lock was not archived.",components:[]});return true;}
await i.update({content:"Archiving the Chaster shared lock…",components:[]});
try{const token=await accessToken(i.user.id),owned=await getSharedLocks(token);if(!isOwnedResourceListed(owned,p.sharedLockId,["items","locks","sharedLocks","data"],"_id","id"))throw new Error("This shared lock is no longer present in your own Chaster shared-lock list. No archive request was made.");await archiveSharedLock(p.sharedLockId,token);await i.followUp({ephemeral:true,content:"Chaster accepted the shared-lock archive request."});}
catch(e){await i.followUp({ephemeral:true,content:"Chaster did not confirm archiving: "+e.message});}
return true;
}
if(i.customId.startsWith("cd:")||i.customId.startsWith("cx:")){
const [action,id]=i.customId.split(":");const result=consumeConfirmation(pending,id,i.user.id,"calendar-delete",action,"cd","cx");const p=result.entry;
if(result.status==="invalid"){await i.reply({ephemeral:true,content:"This confirmation expired or belongs to another user."});return true;}
if(result.status==="expired"){await i.update({content:"Confirmation expired. No event was deleted.",components:[]});return true;}
if(result.status==="cancelled"){await i.update({content:"Cancelled. No calendar event was deleted.",components:[]});return true;}
await i.update({content:"Deleting the Chaster calendar event…",components:[]});
try{const token=await accessToken(i.user.id),owned=await getCalendarEvents(token);if(!isOwnedResourceListed(owned,p.eventId,["items","events","data"],"_id","id","eventId","event_id"))throw new Error("This event is no longer present in your own Chaster calendar. No deletion request was made.");await deleteCalendarEvent(p.eventId,token);await i.followUp({ephemeral:true,content:"Chaster accepted the calendar event deletion."});}
catch(e){await i.followUp({ephemeral:true,content:"Chaster did not confirm deletion: "+e.message});}
return true;
}
if(!i.customId.startsWith("tc:")&&!i.customId.startsWith("tx:"))return false;const [action,id]=i.customId.split(":");const result=consumeConfirmation(pending,id,i.user.id,"time-change",action,"tc","tx");const p=result.entry;if(result.status==="invalid"){await i.reply({ephemeral:true,content:"Confirmation expired or belongs to another user."});return true;}if(result.status==="expired"){await i.update({content:"Confirmation expired. No change made.",components:[]});return true;}if(result.status==="cancelled"){await i.update({content:"Cancelled. No Chaster change made.",components:[]});return true;}const roleSettings=getRoleSettings().find(x=>x.guild_id===p.guildId);const keyholderRoleId=roleSettings?.keyholder_role_id;const member=await i.guild?.members.fetch(i.user.id).catch(()=>null);if(!keyholderRoleId||!member?.roles.cache.has(keyholderRoleId)){await i.update({content:"Your Keyholder role is no longer present. No Chaster change was made.",components:[]});return true;}await i.update({content:"Rechecking keyholder access and sending confirmed request…",components:[]});try{const token=await accessToken(i.user.id);const raw=await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);const lock=a.find(x=>String(x._id||x.id)===p.lockId);if(!lock||lock.trusted!==true||lock.role!=="keyholder")throw new Error("Keyholder authorization, role or trust check failed.");await updateLockTime(p.lockId,p.seconds,token);audit(p.guildId,i.user.id,"chaster_time_change",p.lockId+" duration="+p.seconds+" reason="+p.reason);await i.followUp({ephemeral:true,content:"Chaster accepted the update request. Check the lock in Chaster to verify the timer."});}catch(e){console.error("Time change failed:",e.message);await i.followUp({ephemeral:true,content:"Chaster did not confirm the change: "+e.message});}return true;}

export async function handleModal(i){
  if(!i.customId.startsWith('dashsessioninvite-submit:'))return false;
  const userId=i.customId.split(':')[1];
  if(userId!==i.user.id){await i.reply({ephemeral:true,content:'This dashboard belongs to another member.'});return true;}
  if(!i.guild){await i.reply({ephemeral:true,content:'Open the dashboard from a server.'});return true;}
  try{
    const message=await sendDashboardSessionInvite(i,i.fields.getTextInputValue('member_id'));
    await i.reply({ephemeral:true,content:message});
  }catch(error){await i.reply({ephemeral:true,content:error.message||'The invitation could not be sent.'});}
  return true;
}
