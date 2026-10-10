"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("V9 staging never enables the legacy live bridge or accepts ordinary live orders",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");
 assert.match(source,/const STAGING_DISABLE_BRIDGE=process\.env\.MYPOS_STAGING_ONLY==="true"/);
 assert.match(source,/const isBridge=req=>!STAGING_DISABLE_BRIDGE&&/);
 assert.match(source,/if\(STAGING_DISABLE_BRIDGE\)return send\(res,403,\{error:"Sito di prova: gli ordini reali sono disabilitati"\}\)/);
});
test("V9 ticket generator has no network or printer I/O",()=>{
 for(const name of ["v9-layout2-escpos.js","v9-prepare-tickets.js"]){
  const source=fs.readFileSync(path.join(__dirname,"..","lib",name),"utf8");
  assert.doesNotMatch(source,/require\(["'](?:node:)?(?:net|http|https|child_process)["']\)/,name);
  assert.doesNotMatch(source,/\.connect\(|\.writeFileSync\(|\.createConnection\(/,name);
 }
});
