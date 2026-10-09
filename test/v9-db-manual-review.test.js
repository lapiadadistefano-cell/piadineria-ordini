"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const {resolvePrintReview}=require("../lib/print-review");
test("sandbox manual review is persisted atomically and cannot be repeated",async()=>{
 const ref="LAB-REVIEW-001";
 let saved={payment_reference:ref,status:"print_review_required",payment_method:"mypos",payment_status:"paid",payment_verified:true};
 let commits=0,rollbacks=0;
 class FakePool{
  async connect(){return {query:async(sql,args=[])=>{
   if(sql==="BEGIN")return {};
   if(sql==="COMMIT"){commits++;return {};}
   if(sql==="ROLLBACK"){rollbacks++;return {};}
   if(sql.includes("SELECT order_data"))return {rowCount:1,rows:[{order_data:structuredClone(saved)}]};
   if(sql.includes("UPDATE sandbox_orders")){saved=JSON.parse(args[1]);return {rowCount:1};}
   throw Error("Unexpected SQL");
  },release(){}};}
  async end(){}
 }
 const original=Module._load,modulePath=require.resolve("../lib/sandbox-postgres");
 try{
  Module._load=function(request,parent,isMain){if(request==="pg"&&parent?.filename===modulePath)return {Pool:FakePool};return original.apply(this,arguments);};
  delete require.cache[modulePath];
  const {createSandboxStore}=require("../lib/sandbox-postgres");
  const store=createSandboxStore("fake-only");
  const result=await store.resolvePrintReview(ref,"confirm_printed","Test",resolvePrintReview);
  assert.equal(result.status,"printed");assert.equal(saved.print_review.reviewer,"Test");
  assert.equal(commits,1);
  await assert.rejects(()=>store.resolvePrintReview(ref,"retry_after_check","Test",resolvePrintReview),/not eligible/);
  assert.equal(rollbacks,1);
  await assert.rejects(()=>store.resolvePrintReview("REAL-123","retry_after_check","Test",resolvePrintReview),/Lab reference/);
  await store.close();
 }finally{Module._load=original;delete require.cache[modulePath];}
});
