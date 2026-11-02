import test from "node:test";
import assert from "node:assert/strict";
import {consumeConfirmation} from "../src/confirmations.js";

function setup(overrides={}){
  const pending=new Map([["nonce",{user:"discord-user",kind:"time-change",created:1000,lockId:"lock-1",...overrides}]]);
  return pending;
}

test("only the owner can consume a matching confirmation",()=>{
  const pending=setup();
  assert.equal(consumeConfirmation(pending,"nonce","attacker","time-change","tc","tc","tx",1100).status,"invalid");
  assert.equal(pending.has("nonce"),true,"unauthorized attempt must not consume the owner's confirmation");
  const result=consumeConfirmation(pending,"nonce","discord-user","time-change","tc","tc","tx",1100);
  assert.equal(result.status,"confirmed");
  assert.equal(result.entry.lockId,"lock-1");
  assert.equal(pending.has("nonce"),false);
});

test("confirmation kind and button action must match",()=>{
  const pending=setup();
  assert.equal(consumeConfirmation(pending,"nonce","discord-user","calendar-delete","tc","tc","tx",1100).status,"invalid");
  assert.equal(consumeConfirmation(pending,"nonce","discord-user","time-change","unknown","tc","tx",1100).status,"invalid");
  assert.equal(pending.has("nonce"),true);
  assert.equal(consumeConfirmation(pending,"nonce","discord-user","time-change","tx","tc","tx",1100).status,"cancelled");
  assert.equal(pending.has("nonce"),false);
});

test("expired and future-dated confirmations are consumed without approval",()=>{
  const expired=setup();
  assert.equal(consumeConfirmation(expired,"nonce","discord-user","time-change","tc","tc","tx",122001).status,"expired");
  assert.equal(expired.has("nonce"),false);
  const future=setup();
  assert.equal(consumeConfirmation(future,"nonce","discord-user","time-change","tc","tc","tx",900).status,"expired");
  assert.equal(future.has("nonce"),false);
});

test("a confirmation cannot be replayed after its first use",()=>{
  const pending=setup();
  assert.equal(consumeConfirmation(pending,"nonce","discord-user","time-change","tc","tc","tx",1100).status,"confirmed");
  assert.equal(consumeConfirmation(pending,"nonce","discord-user","time-change","tc","tc","tx",1200).status,"invalid");
});

test("missing or malformed pending entries fail closed",()=>{
  const pending=new Map([["bad",{user:"discord-user",kind:"time-change",created:NaN}]]);
  assert.equal(consumeConfirmation(pending,"missing","discord-user","time-change","tc","tc","tx",1100).status,"invalid");
  assert.equal(consumeConfirmation(pending,"bad","discord-user","time-change","tc","tc","tx",1100).status,"expired");
});
