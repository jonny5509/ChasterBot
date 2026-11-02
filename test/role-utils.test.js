import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLockRows,
  isActiveWearerLock,
  shouldHaveWearerRole,
  shouldHaveKeyholderRole
} from "../src/role-utils.js";

test("normalizes supported Chaster lock collection shapes",()=>{
  const rows=[{id:"one"}];
  assert.equal(normalizeLockRows(rows),rows);
  for(const key of ["locks","items","data","results"]){
    assert.deepEqual(normalizeLockRows({[key]:rows}),rows);
  }
  assert.deepEqual(normalizeLockRows(null),[]);
  assert.deepEqual(normalizeLockRows({unexpected:rows}),[]);
});

test("wearer role requires at least one active or locked lock",()=>{
  assert.equal(isActiveWearerLock({status:"active"}),true);
  assert.equal(isActiveWearerLock({status:"LOCKED"}),true);
  assert.equal(isActiveWearerLock({status:"pending"}),false);
  assert.equal(isActiveWearerLock(null),false);
  assert.equal(shouldHaveWearerRole({locks:[{status:"expired"}]}),false);
  assert.equal(shouldHaveWearerRole({data:[{status:"active"}]}),true);
  assert.equal(shouldHaveWearerRole([]),false);
});

test("keyholder role requires a non-empty keyholder lock list",()=>{
  assert.equal(shouldHaveKeyholderRole([{id:"lock-1"}]),true);
  assert.equal(shouldHaveKeyholderRole({results:[{id:"lock-2"}]}),true);
  assert.equal(shouldHaveKeyholderRole({locks:[]}),false);
  assert.equal(shouldHaveKeyholderRole({unexpected:[{id:"lock"}]}),false);
});
