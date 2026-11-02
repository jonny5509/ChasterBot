import test from "node:test";
import assert from "node:assert/strict";
import {createAuthorizationUrl} from "../src/oauth.js";
import {consumeOAuthState} from "../src/db.js";

test("OAuth authorization URL binds a random one-time state to the Discord user",()=>{
  const previous={
    id:process.env.CHASTER_CLIENT_ID,
    secret:process.env.CHASTER_CLIENT_SECRET,
    redirect:process.env.CHASTER_REDIRECT_URI
  };
  process.env.CHASTER_CLIENT_ID="test-client";
  process.env.CHASTER_CLIENT_SECRET="test-secret";
  process.env.CHASTER_REDIRECT_URI="https://bot.example.test/oauth/chaster/callback";
  try{
    const discordId="oauth-test-"+Date.now()+"-"+Math.random().toString(16).slice(2);
    const url=new URL(createAuthorizationUrl(discordId));
    assert.equal(url.origin,"https://sso.chaster.app");
    assert.equal(url.searchParams.get("client_id"),"test-client");
    assert.equal(url.searchParams.get("redirect_uri"),process.env.CHASTER_REDIRECT_URI);
    assert.equal(url.searchParams.get("response_type"),"code");
    const state=url.searchParams.get("state");
    assert.match(state,/^[a-f0-9]{64}$/);
    assert.equal(consumeOAuthState(state),discordId);
    assert.equal(consumeOAuthState(state),null,"OAuth state must be single-use");
  }finally{
    for(const [key,value] of Object.entries({
      CHASTER_CLIENT_ID:previous.id,
      CHASTER_CLIENT_SECRET:previous.secret,
      CHASTER_REDIRECT_URI:previous.redirect
    })){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
  }
});

test("OAuth URL creation fails closed when client configuration is incomplete",()=>{
  const previous=process.env.CHASTER_CLIENT_ID;
  try{
    delete process.env.CHASTER_CLIENT_ID;
    assert.throws(()=>createAuthorizationUrl("oauth-config-test"),/Set Chaster OAuth client ID/);
  }finally{
    if(previous===undefined)delete process.env.CHASTER_CLIENT_ID;
    else process.env.CHASTER_CLIENT_ID=previous;
  }
});
