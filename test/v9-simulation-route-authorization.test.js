"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("V9 sandbox simulations and diagnostics require lab authorization",()=>{
 const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 const endpoints=[
  "/api/mypos/recovery-check",
  "/api/mypos/claim-simulation",
  "/api/mypos/lifecycle-simulation",
  "/api/mypos/print-simulation",
  "/api/mypos/persistence-check",
  "/api/mypos/diagnostics"
 ];
 for(const endpoint of endpoints){
  const marker='u.pathname==="'+endpoint+'"){';
  const pos=server.indexOf(marker);
  assert.notEqual(pos,-1,"Missing endpoint "+endpoint);
  const block=server.slice(pos+marker.length,pos+marker.length+180);
  assert.match(block,/isAuthorizedLabRequest\(req,process\.env\)/,endpoint+" must check lab key before work");
 }
});
