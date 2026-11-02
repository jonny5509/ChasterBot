import test from "node:test";
import assert from "node:assert/strict";
import {markChasterLinkNeedsReauth,clearChasterLinkHealth,getChasterLinkHealth,deleteLinkedAccount} from "../src/db.js";

test("Chaster authorization health flags a revoked link and throttles repeat notices",()=>{
  const id="auth-health-test-"+Date.now()+"-"+Math.random().toString(16).slice(2);
  try{
    assert.equal(getChasterLinkHealth(id),null);
    assert.equal(markChasterLinkNeedsReauth(id,"401"),true);
    assert.equal(getChasterLinkHealth(id)?.status,"needs_reauth");
    assert.equal(markChasterLinkNeedsReauth(id,"401 again"),false);
    assert.equal(getChasterLinkHealth(id)?.reason,"401 again");
    clearChasterLinkHealth(id);
    assert.equal(getChasterLinkHealth(id),null);
    assert.equal(markChasterLinkNeedsReauth(id,"revoked after relink"),true);
  }finally{
    clearChasterLinkHealth(id);
    deleteLinkedAccount(id);
  }
});

test("unlinking an account clears its authorization health record",()=>{
  const id="auth-health-unlink-"+Date.now()+"-"+Math.random().toString(16).slice(2);
  markChasterLinkNeedsReauth(id);
  deleteLinkedAccount(id);
  assert.equal(getChasterLinkHealth(id),null);
});
