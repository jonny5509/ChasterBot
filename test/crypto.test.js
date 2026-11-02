import test from "node:test";
import assert from "node:assert/strict";
import {encryptJSON,decryptJSON} from "../src/crypto.js";

const VALID_KEY="0123456789abcdef".repeat(4);

test("encrypted token payload round-trips without exposing plaintext",()=>{
  const previous=process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
  process.env.CHASTER_TOKEN_ENCRYPTION_KEY=VALID_KEY;
  try{
    const secrets={access_token:"access-secret-value",refresh_token:"refresh-secret-value",expires_at:123456};
    const encrypted=encryptJSON(secrets);
    assert.equal(typeof encrypted,"string");
    assert.equal(encrypted.includes(secrets.access_token),false);
    assert.equal(encrypted.includes(secrets.refresh_token),false);
    assert.deepEqual(decryptJSON(encrypted),secrets);
  }finally{
    if(previous===undefined)delete process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
    else process.env.CHASTER_TOKEN_ENCRYPTION_KEY=previous;
  }
});

test("decryptJSON rejects modified ciphertext",()=>{
  const previous=process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
  process.env.CHASTER_TOKEN_ENCRYPTION_KEY=VALID_KEY;
  try{
    const encrypted=JSON.parse(encryptJSON({access_token:"secret"}));
    encrypted.data=Buffer.from("tampered payload").toString("base64");
    assert.throws(()=>decryptJSON(JSON.stringify(encrypted)));
  }finally{
    if(previous===undefined)delete process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
    else process.env.CHASTER_TOKEN_ENCRYPTION_KEY=previous;
  }
});

test("encryption rejects a missing or malformed key",()=>{
  const previous=process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
  try{
    delete process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
    assert.throws(()=>encryptJSON({access_token:"secret"}),/64 hex characters/);
    process.env.CHASTER_TOKEN_ENCRYPTION_KEY="not-a-valid-key";
    assert.throws(()=>decryptJSON("{}"),/64 hex characters/);
  }finally{
    if(previous===undefined)delete process.env.CHASTER_TOKEN_ENCRYPTION_KEY;
    else process.env.CHASTER_TOKEN_ENCRYPTION_KEY=previous;
  }
});
