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

test("real PostgreSQL: checked retry remains pending, then one claim only", {skip:!url}, async()=>{
 const {claim}=require("../lib/print-recovery");
 const ref="LAB-RETRY-"+process.pid+"-"+Date.now();
 const store=createSandboxStore(url);
 try{
  await store.init();
  assert.equal((await store.createLabReview(ref)).created,true);
  const reviewed=await store.resolvePrintReview(ref,"retry_after_check","Operatore Test",resolvePrintReview);
  assert.equal(reviewed.status,"pending");
  const saved=await store.get(ref);
  assert.equal(saved.print_review.action,"retry_after_check");
  assert.equal(saved.print_review.reviewer,"Operatore Test");
  assert.equal(saved.print_claim,null);
  assert.equal(saved.status,"pending");
  await assert.rejects(()=>store.resolvePrintReview(ref,"retry_after_check","Operatore Test",resolvePrintReview),/not eligible/);
  const first=await store.claimPrint(ref,"worker-test-token",claim);
  assert.equal(first.claimed,true);
  const duplicate=await store.claimPrint(ref,"worker-other-token",claim);
  assert.equal(duplicate.claimed,false);
  assert.equal((await store.get(ref)).status,"printing");
  await store.close();
  const reopened=createSandboxStore(url);
  try{
   const persisted=await reopened.get(ref);
   assert.equal(persisted.status,"printing");
   assert.equal(persisted.print_review.action,"retry_after_check");
  }finally{await reopened.close();}
 }catch(e){
  // Ensure failed assertions never leave an open pool in CI.
  try{await store.close();}catch{}
  throw e;
 }
});

test("real PostgreSQL: forged LAB prefix cannot authorize review of an actual order", {skip:!url}, async()=>{
 const ref="LAB-GUARD-"+process.pid+"-"+Date.now();
 const store=createSandboxStore(url);
 try{
  await store.init();
  const realLike={
   id:ref,payment_reference:ref,customer_name:"Test only",
   payment_method:"mypos",payment_status:"paid",payment_verified:true,
   status:"print_review_required",lab_only:false,
   simulated_payment:false,no_real_transaction:false
  };
  await store.insert(realLike);
  await assert.rejects(
   ()=>store.resolvePrintReview(ref,"retry_after_check","Operatore Test",resolvePrintReview),
   /not eligible/
  );
  assert.deepEqual(await store.get(ref),realLike);
 }finally{await store.close();}
});
