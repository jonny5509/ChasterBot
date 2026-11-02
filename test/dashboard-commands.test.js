import test from "node:test";
import assert from "node:assert/strict";
import {DASHBOARD_COMMAND_GROUPS,getDashboardCommandGroups} from "../src/dashboard-commands.js";

const allNames=DASHBOARD_COMMAND_GROUPS.flatMap(([,names])=>names);

test("dashboard command groups contain no duplicate command names",()=>{
  assert.equal(new Set(allNames).size,allNames.length);
});

test("wearer and keyholder commands are hidden until their configured roles are assigned",()=>{
  const groups=getDashboardCommandGroups(allNames);
  const visible=groups.flatMap(group=>group.commands);
  assert.equal(visible.includes("lock-status"),false);
  assert.equal(visible.includes("keyholder-locks"),false);
  const roleGroups=getDashboardCommandGroups(allNames,{hasWearerRole:true,hasKeyholderRole:true});
  const roleVisible=roleGroups.flatMap(group=>group.commands);
  assert.equal(roleVisible.includes("lock-status"),true);
  assert.equal(roleVisible.includes("keyholder-locks"),true);
  assert.equal(roleVisible.includes("time-change"),true);
});

test("administration commands respect Manage Server and Manage Roles separately",()=>{
  const base=getDashboardCommandGroups(allNames).flatMap(group=>group.commands);
  assert.equal(base.includes("configure-roles"),false);
  assert.equal(base.includes("session-channel"),false);
  const roles=getDashboardCommandGroups(allNames,{canManageRoles:true}).flatMap(group=>group.commands);
  assert.equal(roles.includes("configure-roles"),true);
  assert.equal(roles.includes("session-channel"),false);
  const guild=getDashboardCommandGroups(allNames,{canManageGuild:true}).flatMap(group=>group.commands);
  assert.equal(guild.includes("session-channel"),true);
  assert.equal(guild.includes("configure-roles"),false);
});

test("unregistered commands are never displayed",()=>{
  const visible=getDashboardCommandGroups(["help","made-up-command"]).flatMap(group=>group.commands);
  assert.deepEqual(visible,["help"]);
});
