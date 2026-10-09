"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createSandboxStore}=require("../lib/sandbox-postgres");
const {resolvePrintReview}=require("../lib/print-review");
const url=process.env.V9_INTEGRATION_DATABASE_URL;
test("real PostgreSQL: LAB fixture, durable review, duplicate denial, and isolation", {skip:!url}, async()=>{
 const store=createSandboxStore(url);
 const ref="LAB-PG-"+process.pid+"-"+Date.now();
 try{
  await store.init();
  const first=await store.createLabReview(ref);
  assert.equal(first.created,true);
  assert.equal((await store.createLabReview(ref)).created,false);
  assert.equal((await store.get(ref)).status,"print_review_required");
  const resolved=await store.resolvePrintReview(ref,"confirm_printed","Operatore Test",resolvePrintReview);
  assert.equal(resolved.status,"printed");
  await store.close();
  const again=createSandboxStore(url);
  try{
   const saved=await again.get(ref);
   assert.equal(saved.status,"printed");
   assert.equal(saved.print_review.reviewer,"Operatore Test");
   assert.equal(saved.print_review.action,"confirm_printed");
   await assert.rejects(()=>again.resolvePrintReview(ref,"retry_after_check","Test",resolvePrintReview),/not eligible/);
  }finally{await again.close();}
 }finally{
  // The database is an ephemeral GitHub Actions service, never Render staging.
  // Do not delete data from persistent environments.
 }
});
