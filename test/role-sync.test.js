import test from "node:test";
import assert from "node:assert/strict";
import {getRoleSyncIntervalMinutes} from "../src/role-sync.js";

test("role sync interval defaults to ten minutes",()=>{
  assert.equal(getRoleSyncIntervalMinutes(undefined),10);
  assert.equal(getRoleSyncIntervalMinutes(""),10);
});

test("role sync interval accepts whole minutes from 1 to 1440",()=>{
  assert.equal(getRoleSyncIntervalMinutes("1"),1);
  assert.equal(getRoleSyncIntervalMinutes("30"),30);
  assert.equal(getRoleSyncIntervalMinutes("1440"),1440);
});

test("invalid role sync intervals safely fall back to ten minutes",()=>{
  for(const value of ["0","-1","1.5","1441","abc"])assert.equal(getRoleSyncIntervalMinutes(value),10);
});
