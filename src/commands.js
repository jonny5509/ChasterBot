import {SlashCommandBuilder,PermissionFlagsBits,ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType} from "discord.js";
import {ensureProfile,leaderboard,createChallenge,joinChallenge,approveChallenge,setNotificationChannel,setNotificationOptIn,recentAudit,addPoints,addRewardItem,listRewardItems,audit,getLinkedAccount,deleteLinkedAccount,setGuildRoles,setSessionChannel,getSessionChannel,createSessionInvite,consumeSessionInvite,getRoleSettings} from "./db.js";
import {createAuthorizationUrl,getTokensForDiscordUser} from "./oauth.js";
import {getMyLocks,getKeyholderLocks,updateLockTime,getCurrentProfile,getSharedLocks,getConversations,getCalendarEvents,getNotificationCounts,getLockDetails,getLockSeal,getKeyholderNotes,getChasterSettings,getPermissionDefinitions,getUserProfileOverview,getUserProfileStatistics,getUserAchievements,getUserBadgeCount,getLockHistory,getKeyholderApplications,getConversation,getConversationMessages,getSharedLockFavorite,addSharedLockFavorite,removeSharedLockFavorite,getNotificationChannelHealth,markNotificationRead,markAllNotificationsRead,getSharedLockDetails,getSharedLockTags,getExtensions,getExploreCategories,getCalendarStatistics,getBlockedUsers,getAchievementCategories,getIgnoredUsers,getLockStatsResetConfig,getCommunityEventCategories,getPublicLocks,createCalendarEvent,updateCalendarEvent,deleteCalendarEvent} from "./chaster.js";
import {keyholderReply} from "./persona.js";
import {randomUUID} from "node:crypto";
import {syncUserRoles} from "./role-sync.js";
const pending=new Map();
export const commands=[
new SlashCommandBuilder().setName("help").setDescription("Show bot commands."),
new SlashCommandBuilder().setName("link-chaster").setDescription("Securely link your Chaster account."),
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
new SlashCommandBuilder().setName("notifications").setDescription("Opt in or out of lock updates.").addBooleanOption(o=>o.setName("enabled").setDescription("Receive updates in this server").setRequired(true)),
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
export async function handleCommand(i){const n=i.commandName;
if(n==="lock-status"&&!await requireConfiguredRole(i,"wearer"))return;
if((n==="keyholder-locks"||n==="time-change"||n==="keyholder-notes")&&!await requireConfiguredRole(i,"keyholder"))return;
if(n==="keyholder-applications"&&!await requireConfiguredRole(i,"wearer"))return;
if(n==="configure-roles"){const w=i.options.getRole("wearer",true),k=i.options.getRole("keyholder",true);if(w.id===k.id)return i.reply({ephemeral:true,content:"Choose two different roles."});setGuildRoles(i.guildId,w?.id,k?.id,i.user.id);return i.reply({ephemeral:true,content:"Role configuration saved. The bot needs Manage Roles, and both selected roles must be below its highest role."});}
if(n==="sync-roles"){await i.deferReply({ephemeral:true});const result=await syncUserRoles(i.client,i.user.id);return i.editReply(result.message);}
if(n==="session-channel"){const c=i.options.getChannel("channel",true);if(c.type!==ChannelType.GuildText)return i.reply({ephemeral:true,content:"Choose a regular text channel (not a forum or announcement channel)."});setSessionChannel(i.guildId,c.id,i.user.id);return i.reply({ephemeral:true,content:"Private session threads will be created under "+c+"."});}
if(n==="session-invite"){const other=i.options.getUser("user",true);if(other.bot||other.id===i.user.id)return i.reply({ephemeral:true,content:"Choose another human member."});if(!getLinkedAccount(i.user.id)||!getLinkedAccount(other.id))return i.reply({ephemeral:true,content:"Both participants must link their Chaster accounts first using /link-chaster."});const parent=getSessionChannel(i.guildId);if(!parent)return i.reply({ephemeral:true,content:"An admin must configure a session channel with /session-channel first."});const channel=await i.guild.channels.fetch(parent).catch(()=>null);if(!channel||channel.type!==ChannelType.GuildText)return i.reply({ephemeral:true,content:"The configured session channel is unavailable."});const id=randomUUID();createSessionInvite(id,i.guildId,parent,i.user.id,other.id,Date.now()+600000);const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("session-accept:"+id).setLabel("Accept private session").setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId("session-decline:"+id).setLabel("Decline").setStyle(ButtonStyle.Secondary));const dm=await other.send({content:"<@"+i.user.id+"> invited you to a private ChasterBot session in **"+i.guild.name+"**. Both of you must have linked Chaster accounts. This invitation expires in 10 minutes.",components:[row]}).catch(()=>null);if(!dm)return i.reply({ephemeral:true,content:"I could not DM that member. They may need to enable server-member DMs before you can invite them."});return i.reply({ephemeral:true,content:"Invitation sent by DM to "+other.username+". They must accept before a private thread is created."});}
if(n==="help")return i.reply({ephemeral:true,content:"**ChasterBot Enhanced**\n/link-chaster · /unlink-chaster · /lock-status · /keyholder-locks · /time-change\n/chaster-profile · /shared-locks · /chaster-conversations · /chaster-calendar · /chaster-notifications\n/lock-details · /lock-seal · /keyholder-notes · /chaster-settings · /permission-catalog\n/chaster-user-overview · /chaster-user-stats · /chaster-achievements · /chaster-badges · /lock-history · /keyholder-applications\n/chaster-conversation · /chaster-messages · /shared-lock-favorite · /chaster-notification-health · /chaster-notification-read · /chaster-notifications-read-all\n/shared-lock-details · /shared-lock-tags · /chaster-extensions · /chaster-explore-categories · /chaster-calendar-stats · /chaster-blocks\n/chaster-achievement-categories · /chaster-ignored-users · /chaster-lock-stats-config · /chaster-community-categories · \n/chaster-public-locks · \n/calendar-event-add · /calendar-event-edit · /calendar-event-delete\n/notifications · /profile · /leaderboard · /award-points\n/challenge · /challenge-join · /challenge-approve\n/reward-add · /punishment-add · /reward-list · /punishment-list\n/dice · /keyholder-chat · /notify-channel · /audit\nLock changes always require a linked keyholder, a verified keyheld lock, a 24-hour per-command bound and explicit confirmation."});
if(n==="link-chaster")return i.reply({ephemeral:true,content:"Authorize Chaster using this private link (expires in 10 minutes):\n"+createAuthorizationUrl(i.user.id)});
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
if(n==="calendar-event-delete"){
const eventId=i.options.getString("event_id",true),id=randomUUID();pending.set(id,{user:i.user.id,eventId,created:Date.now(),kind:"calendar-delete"});
const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("cd:"+id).setLabel("Confirm delete").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("cx:"+id).setLabel("Cancel").setStyle(ButtonStyle.Secondary));
return i.reply({ephemeral:true,content:"Delete Chaster calendar event "+eventId+"? This cannot be undone.",components:[row]});
}
if(n==="lock-status"||n==="keyholder-locks"){await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);const raw=n==="lock-status"?await getMyLocks(token):await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);return i.editReply(a.length?(n==="lock-status"?"**Your Chaster locks**\n":"**Locks you keyhold**\n")+a.slice(0,15).map(lockLine).join("\n"):"No locks returned for this account.");}
if(n==="time-change"){const lockId=i.options.getString("lock_id",true),seconds=i.options.getInteger("seconds",true),reason=i.options.getString("reason",true);if(!seconds)return i.reply({ephemeral:true,content:"Seconds must be non-zero."});await i.deferReply({ephemeral:true});const token=await accessToken(i.user.id);const raw=await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);const lock=a.find(x=>String(x._id||x.id)===lockId);if(!lock)return i.editReply("That lock is not in your Chaster keyholder lock list. No change made.");if(lock.trusted!==true||lock.role!=="keyholder")return i.editReply("Chaster did not confirm a trusted keyholder role for this lock. No change made.");const nonce=randomUUID();pending.set(nonce,{user:i.user.id,lockId,seconds,reason,guildId:i.guildId,created:Date.now()});const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("tc:"+nonce).setLabel("Confirm time change").setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId("tx:"+nonce).setLabel("Cancel").setStyle(ButtonStyle.Secondary));return i.editReply({content:"**Confirm Chaster time change**\n"+String(lock.title||lockId)+"\n"+(seconds>0?"Add ":"Remove ")+Math.abs(seconds)+" seconds\nReason: "+reason+"\nNo change occurs unless you press Confirm.",components:[row]});}
if(n==="notifications"){const on=i.options.getBoolean("enabled",true);setNotificationOptIn(i.guildId,i.user.id,on);return i.reply({ephemeral:true,content:on?"You opted in to lock updates in this server.":"You opted out of lock updates in this server."});}
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
export async function handleButton(i){
if(i.customId.startsWith("session-accept:")||i.customId.startsWith("session-decline:")){const [action,id]=i.customId.split(":");const inv=consumeSessionInvite(id);if(!inv||inv.invitee_id!==i.user.id){await i.reply({ephemeral:true,content:"This invitation expired or is not addressed to you."});return true;}if(action==="session-decline"){await i.update({content:"You declined the private session invitation.",components:[]});return true;}const guild=await i.client.guilds.fetch(inv.guild_id).catch(()=>null);if(!guild){await i.update({content:"The server is unavailable.",components:[]});return true;}const parent=await guild.channels.fetch(inv.channel_id).catch(()=>null);if(!parent||parent.type!==ChannelType.GuildText){await i.update({content:"The configured session channel is unavailable.",components:[]});return true;}try{const inviter=await guild.members.fetch(inv.inviter_id),invitee=await guild.members.fetch(inv.invitee_id);const thread=await parent.threads.create({name:("Chaster · "+inviter.user.username+" + "+invitee.user.username).slice(0,100),autoArchiveDuration:1440,type:ChannelType.PrivateThread,invitable:false,reason:"Mutual opt-in ChasterBot session"});await thread.members.add(inv.inviter_id);await thread.members.add(inv.invitee_id);await thread.send({content:"Welcome to your private ChasterBot session. Participants: <@"+inv.inviter_id+"> and <@"+inv.invitee_id+">. The bot can help with lock status, optional challenges and coordination. Both participants can leave at any time. Do not share passwords or access tokens here.",allowedMentions:{users:[inv.inviter_id,inv.invitee_id]}});await i.update({content:"You accepted. Your private session thread has been created: "+thread.toString(),components:[]});await inviter.send("Your ChasterBot session with "+invitee.user.username+" is ready: "+thread.toString()).catch(()=>{});}catch(e){console.error("Private session creation failed:",e.message);await i.update({content:"Could not create the private thread. Ask a server admin to check the bot's Create Private Threads, Manage Threads and Send Messages in Threads permissions.",components:[]});}return true;}
if(i.customId.startsWith("cd:")||i.customId.startsWith("cx:")){
const [action,id]=i.customId.split(":");const p=pending.get(id);
if(!p||p.user!==i.user.id||p.kind!=="calendar-delete"){await i.reply({ephemeral:true,content:"This confirmation expired or belongs to another user."});return true;}
pending.delete(id);if(Date.now()-p.created>120000){await i.update({content:"Confirmation expired. No event was deleted.",components:[]});return true;}
if(action==="cx"){await i.update({content:"Cancelled. No calendar event was deleted.",components:[]});return true;}
await i.update({content:"Deleting the Chaster calendar event…",components:[]});
try{const token=await accessToken(i.user.id);await deleteCalendarEvent(p.eventId,token);await i.followUp({ephemeral:true,content:"Chaster accepted the calendar event deletion."});}
catch(e){await i.followUp({ephemeral:true,content:"Chaster did not confirm deletion: "+e.message});}
return true;
}
if(!i.customId.startsWith("tc:")&&!i.customId.startsWith("tx:"))return false;const [action,id]=i.customId.split(":");const p=pending.get(id);if(!p||p.user!==i.user.id){await i.reply({ephemeral:true,content:"Confirmation expired or belongs to another user."});return true;}pending.delete(id);if(Date.now()-p.created>120000){await i.update({content:"Confirmation expired. No change made.",components:[]});return true;}if(action==="tx"){await i.update({content:"Cancelled. No Chaster change made.",components:[]});return true;}const roleSettings=getRoleSettings().find(x=>x.guild_id===p.guildId);const keyholderRoleId=roleSettings?.keyholder_role_id;const member=await i.guild?.members.fetch(i.user.id).catch(()=>null);if(!keyholderRoleId||!member?.roles.cache.has(keyholderRoleId)){await i.update({content:"Your Keyholder role is no longer present. No Chaster change was made.",components:[]});return true;}await i.update({content:"Rechecking keyholder access and sending confirmed request…",components:[]});try{const token=await accessToken(i.user.id);const raw=await getKeyholderLocks(token);const a=Array.isArray(raw)?raw:(raw?.locks||[]);const lock=a.find(x=>String(x._id||x.id)===p.lockId);if(!lock||lock.trusted!==true||lock.role!=="keyholder")throw new Error("Keyholder authorization, role or trust check failed.");await updateLockTime(p.lockId,p.seconds,token);audit(p.guildId,i.user.id,"chaster_time_change",p.lockId+" duration="+p.seconds+" reason="+p.reason);await i.followUp({ephemeral:true,content:"Chaster accepted the update request. Check the lock in Chaster to verify the timer."});}catch(e){console.error("Time change failed:",e.message);await i.followUp({ephemeral:true,content:"Chaster did not confirm the change: "+e.message});}return true;}
