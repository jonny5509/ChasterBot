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


test("GET requests retry a brief 429 once the Retry-After delay has elapsed",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls===1)return {ok:false,status:429,headers:{get:name=>name==="retry-after"?"0":null},text:async()=>"rate limited"};
    return {ok:true,status:200,json:async()=>({ok:true})};
  };
  assert.deepEqual(await chasterRequest("/example",{token:"test-token"}),{ok:true});
  assert.equal(calls,2);
});

test("write requests are never automatically retried after a rate limit",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return {ok:false,status:429,headers:{get:name=>name==="retry-after"?"0":null},text:async()=>"slow down"};
  };
  await assert.rejects(
    ()=>chasterRequest("/example",{token:"test-token",method:"POST",body:{value:1}}),
    error=>error.status===429&&error.code==="CHASTER_RATE_LIMITED"&&error.retryAfterMs===0
  );
  assert.equal(calls,1);
});

test("long rate limits are surfaced with their retry delay instead of sleeping",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    return {ok:false,status:429,headers:{get:name=>name==="retry-after"?"30":null},text:async()=>"rate limited"};
  };
  await assert.rejects(
    ()=>chasterRequest("/example",{token:"test-token"}),
    error=>error.status===429&&error.retryAfterMs===30000
  );
  assert.equal(calls,1);
});

test("GET requests retry temporary gateway errors with a bounded attempt count",async(t)=>{
  const originalFetch=globalThis.fetch;
  t.after(()=>{globalThis.fetch=originalFetch;});
  let calls=0;
  globalThis.fetch=async()=>{
    calls++;
    if(calls<3)return {ok:false,status:503,headers:{get:()=>null},text:async()=>"temporarily unavailable"};
    return {ok:true,status:200,json:async()=>({recovered:true})};
  };
  assert.deepEqual(await chasterRequest("/example",{token:"test-token"}),{recovered:true});
  assert.equal(calls,3);
});
