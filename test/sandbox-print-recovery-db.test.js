"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const {claim,onRestart}=require("../lib/print-recovery");

test("sandbox database persists interrupted printing as manual review and blocks retry",async()=>{
  const reference="SIM-RECOVERY-TEST";
  let saved={id:reference,payment_reference:reference,status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true};
  let locks=0;
  class FakePool {
    async connect(){
      return {query:async(sql,args=[])=>{
        if(sql==="BEGIN"){locks++;return {rowCount:0,rows:[]};}
        if(sql==="COMMIT"||sql==="ROLLBACK")return {rowCount:0,rows:[]};
        if(sql.includes("SELECT order_data"))return {rowCount:1,rows:[{order_data:structuredClone(saved)}]};
        if(sql.includes("UPDATE sandbox_orders")){assert.equal(args[0],reference);saved=JSON.parse(args[1]);return {rowCount:1,rows:[]};}
        throw Error("Unexpected query");
      },release(){}};
    }
    async end(){}
  }
  const original=Module._load;
  const modulePath=require.resolve("../lib/sandbox-postgres");
  try{
    Module._load=function(request,parent,isMain){if(request==="pg"&&parent?.filename===modulePath)return {Pool:FakePool};return original.apply(this,arguments);};
    delete require.cache[modulePath];
    const {createSandboxStore}=require("../lib/sandbox-postgres");
    const store=createSandboxStore("sandbox-fake-only");
    assert.equal((await store.claimPrint(reference,"fake-worker",claim)).claimed,true);
    assert.equal(saved.status,"printing");
    const recovery=await store.recoverPrint(reference,onRestart);
    assert.equal(recovery.needsReview,true);
    assert.equal((await store.get(reference))?.status,"print_review_required");
    assert.equal((await store.claimPrint(reference,"other-worker",claim)).claimed,false);
    assert.equal((await store.recoverPrint(reference,onRestart)).needsReview,false);
    assert.equal(locks,4);
    await store.close();
  }finally{
    Module._load=original;
    delete require.cache[modulePath];
  }
});
