export const DASHBOARD_COMMAND_GROUPS=[
  ["General",["help","dashboard","profile","leaderboard","dice","keyholder-chat","reward-list","punishment-list"]],
  ["Account and locks",["link-chaster","chaster-link-status","unlink-chaster","lock-status","keyholder-locks","lock-details","lock-seal","lock-history","time-change","keyholder-notes","keyholder-notes-delete","keyholder-applications"]],
  ["Profiles and discovery",["chaster-profile","chaster-user-overview","chaster-user-stats","chaster-achievements","chaster-badges","chaster-achievement-categories","chaster-public-locks","shared-locks","shared-lock-details","shared-lock-tags","shared-lock-favorite","shared-lock-favorite-add","shared-lock-favorite-remove","shared-lock-archive","chaster-extensions","chaster-explore-categories","chaster-settings","permission-catalog","chaster-lock-stats-config","chaster-community-categories"]],
  ["Messaging and notifications",["chaster-conversations","chaster-conversation","chaster-messages","chaster-ignored-users","chaster-blocks","chaster-notifications","chaster-notification-health","chaster-notification-read","chaster-notifications-read-all","notifications","notification-status"]],
  ["Calendar",["chaster-calendar","chaster-calendar-stats","calendar-event-add","calendar-event-edit","calendar-event-delete"]],
  ["Community",["challenge","challenge-join","reward-add","punishment-add"]],
  ["Roles and sessions",["configure-roles","sync-roles","session-channel","session-invite"]],
  ["Server administration",["notification-queue-status","notification-health","notification-failures","notification-history","notification-report","notification-retention","notification-retry","notify-channel","challenge-approve","award-points","audit"]]
];
const wearerOnly=new Set(["lock-status","keyholder-applications"]);
const keyholderOnly=new Set(["keyholder-locks","time-change","keyholder-notes","keyholder-notes-delete"]);
const adminGuildOnly=new Set(["session-channel","notification-queue-status","notification-health","notification-failures","notification-history","notification-report","notification-retention","notification-retry","notify-channel","challenge-approve","award-points","audit"]);
const adminRolesOnly=new Set(["configure-roles"]);

export function getDashboardCommandGroups(registeredNames,{hasWearerRole=false,hasKeyholderRole=false,canManageGuild=false,canManageRoles=false}={}){
  const registered=new Set(registeredNames);
  return DASHBOARD_COMMAND_GROUPS.map(([heading,names])=>({
    heading,
    commands:names.filter(name=>{
      if(!registered.has(name))return false;
      if(wearerOnly.has(name)&&!hasWearerRole)return false;
      if(keyholderOnly.has(name)&&!hasKeyholderRole)return false;
      if(adminGuildOnly.has(name)&&!canManageGuild)return false;
      if(adminRolesOnly.has(name)&&!canManageRoles)return false;
      return true;
    })
  })).filter(group=>group.commands.length);
}
