import test from "node:test";
import assert from "node:assert/strict";
import {collectionRows,isOwnedResourceListed} from "../src/owned-resources.js";

test("reads only supported collection shapes",()=>{
  const rows=[{id:"owned"}];
  assert.equal(collectionRows(rows,"items"),rows);
  for(const key of ["items","locks","sharedLocks","events","data"]){
    assert.deepEqual(collectionRows({[key]:rows},key),rows);
  }
  assert.deepEqual(collectionRows({unknown:rows},"items","events"),[]);
});

test("matches exact resource IDs in the account-owned collection",()=>{
  const raw={items:[{_id:"shared-1",title:"My shared lock"},{id:"shared-2"}]};
  assert.equal(isOwnedResourceListed(raw,"shared-1",["items","locks"],"_id","id"),true);
  assert.equal(isOwnedResourceListed(raw,"shared-2",["items","locks"],"_id","id"),true);
  assert.equal(isOwnedResourceListed(raw,"shared",["items","locks"],"_id","id"),false);
  assert.equal(isOwnedResourceListed(raw,"someone-elses",["items","locks"],"_id","id"),false);
});

test("supports calendar event identifier variants without coercing missing IDs",()=>{
  const raw={events:[{eventId:"event-1"},{event_id:"event-2"},{id:3}]};
  const keys=["_id","id","eventId","event_id"];
  assert.equal(isOwnedResourceListed(raw,"event-1",["events","items","data"],...keys),true);
  assert.equal(isOwnedResourceListed(raw,"event-2",["events","items","data"],...keys),true);
  assert.equal(isOwnedResourceListed(raw,3,["events","items","data"],...keys),true);
  assert.equal(isOwnedResourceListed(raw,"",["events","items","data"],...keys),false);
  assert.equal(isOwnedResourceListed(raw,null,["events","items","data"],...keys),false);
});

test("fails closed for missing or unrecognized API collections",()=>{
  assert.equal(isOwnedResourceListed(null,"id",["items","events"],"_id","id"),false);
  assert.equal(isOwnedResourceListed({results:[{id:"id"}]},"id",["items","events"],"_id","id"),false);
  assert.equal(isOwnedResourceListed({items:[null,"id",{}]},"id",["items"],"_id","id"),false);
});
