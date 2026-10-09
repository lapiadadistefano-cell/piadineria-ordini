"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
test("synthetic LAB review row is isolated, repeat-safe, and has no real payment",async()=>{
 let saved=null;
 class FakePool {
  async query(sql,args){
   assert.match(sql,/ON CONFLICT DO NOTHING/);
   if(saved)return {rowCount:0};
   saved=JSON.parse(args[1]);return {rowCount:1};
  }
  async end(){}
 }
 const original=Module._load,path=require.resolve("../lib/sandbox-postgres");
 try {
  Module._load=function(request,parent,isMain){if(request==="pg"&&parent?.filename===path)return {Pool:FakePool};return original.apply(this,arguments);};
  delete require.cache[path];
  const store=require("../lib/sandbox-postgres").createSandboxStore("fake");
  await assert.rejects(()=>store.createLabReview("REAL-ORDER-123"),/Invalid lab reference/);
  const first=await store.createLabReview("LAB-001");
  assert.equal(first.created,true);
  assert.equal(saved.status,"print_review_required");
  assert.equal(saved.lab_only,true);
  assert.equal(saved.simulated_payment,true);
  assert.equal(saved.no_real_transaction,true);
  assert.equal(saved.customer_name,"Cliente fittizio");
  assert.equal((await store.createLabReview("LAB-001")).created,false);
  await store.close();
 }finally{Module._load=original;delete require.cache[path];}
});
