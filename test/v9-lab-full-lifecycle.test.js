"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const {resolvePrintReview}=require("../lib/print-review");

test("LAB-001 creation, persisted decision, restart read, duplicate refusal and non-lab isolation",async()=>{
 const rows=new Map();
 let commits=0,rollbacks=0;
 class FakePool{
  async query(sql,args=[]){
   if(sql.startsWith("INSERT INTO sandbox_orders")){
    if(rows.has(args[0]))return {rowCount:0};
    rows.set(args[0],JSON.parse(args[1]));return {rowCount:1};
   }
   if(sql.startsWith("SELECT order_data"))return rows.has(args[0])?{rowCount:1,rows:[{order_data:structuredClone(rows.get(args[0]))}]}:{rowCount:0,rows:[]};
   throw Error("Unexpected pool query");
  }
  async connect(){return {query:async(sql,args=[])=>{
   if(sql==="BEGIN")return {};
   if(sql==="COMMIT"){commits++;return {};}
   if(sql==="ROLLBACK"){rollbacks++;return {};}
   if(sql.startsWith("SELECT order_data"))return rows.has(args[0])?{rowCount:1,rows:[{order_data:structuredClone(rows.get(args[0]))}]}:{rowCount:0,rows:[]};
   if(sql.startsWith("UPDATE sandbox_orders")){rows.set(args[0],JSON.parse(args[1]));return {rowCount:1};}
   throw Error("Unexpected transaction query");
  },release(){}};}
  async end(){}
 }
 const original=Module._load,modulePath=require.resolve("../lib/sandbox-postgres");
 try{
  Module._load=function(request,parent,isMain){if(request==="pg"&&parent?.filename===modulePath)return {Pool:FakePool};return original.apply(this,arguments);};
  delete require.cache[modulePath];
  const {createSandboxStore}=require("../lib/sandbox-postgres");
  const first=createSandboxStore("fake");
  assert.equal((await first.createLabReview("LAB-001")).created,true);
  assert.equal((await first.createLabReview("LAB-001")).created,false);
  assert.equal((await first.get("LAB-001")).status,"print_review_required");
  const outcome=await first.resolvePrintReview("LAB-001","confirm_printed","Operatore Test",resolvePrintReview);
  assert.equal(outcome.status,"printed");
  await first.close();
  const restarted=createSandboxStore("fake");
  const persisted=await restarted.get("LAB-001");
  assert.equal(persisted.status,"printed");
  assert.equal(persisted.print_review.reviewer,"Operatore Test");
  assert.equal(persisted.print_review.action,"confirm_printed");
  await assert.rejects(()=>restarted.resolvePrintReview("LAB-001","retry_after_check","Test",resolvePrintReview),/not eligible/);
  rows.set("LAB-OTHER",{payment_reference:"LAB-OTHER",status:"print_review_required",payment_method:"mypos",payment_status:"paid",payment_verified:true});
  await assert.rejects(()=>restarted.resolvePrintReview("LAB-OTHER","confirm_printed","Test",resolvePrintReview),/not eligible/);
  assert.equal(commits,1);assert.equal(rollbacks,2);
  await restarted.close();
 }finally{Module._load=original;delete require.cache[modulePath];}
});
