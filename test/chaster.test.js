import test from "node:test";
import assert from "node:assert/strict";
import {deleteKeyholderNotes,chasterRequest} from "../src/chaster.js";

test("deleteKeyholderNotes sends an authenticated bodyless DELETE request",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let captured;
  globalThis.fetch=async(url,options)=>{captured={url:new URL(url),options};return {ok:true,status:204};};
  const result=await deleteKeyholderNotes("lock/id with space","test-token");
  assert.equal(result,null);
  assert.equal(captured.url.pathname,"/keyholder/notes/lock/lock%2Fid%20with%20space");
  assert.equal(captured.options.method,"DELETE");
  assert.equal(captured.options.headers.Authorization,"Bearer test-token");
  assert.equal(captured.options.headers.Accept,"application/json");
  assert.equal(captured.options.headers["Content-Type"],undefined);
  assert.equal(captured.options.body,undefined);
});

test("chasterRequest rejects requests without a token before fetching",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error("unexpected fetch");};
  await assert.rejects(()=>chasterRequest("/example"),/Chaster account is not linked/);
  assert.equal(called,false);
});

test("chasterRequest reports the HTTP status and a bounded response body",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  globalThis.fetch=async()=>({ok:false,status:403,text:async()=>"Forbidden"});
  await assert.rejects(()=>chasterRequest("/example",{token:"test-token"}),/403.*Forbidden/);
});
