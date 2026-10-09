"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {claim,onRestart}=require("../lib/print-recovery");
const {resolvePrintReview}=require("../lib/print-review");
const {isPrintable}=require("../lib/payment-state");
const paid={id:"FAKE-V9-1",status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true,total:8};
test("uncertain physical print requires review and blocks automatic retry",()=>{
 const c=claim(paid,"token-1");
 assert.equal(c.claimed,true);
 const recovered=onRestart(c.order);
 assert.equal(recovered.needsReview,true);
 assert.equal(recovered.order.status,"print_review_required");
 assert.equal(isPrintable(recovered.order),false);
 assert.equal(claim(recovered.order,"token-2").claimed,false);
});
test("manual confirmation marks printed and never retries",()=>{
 const uncertain=onRestart(claim(paid,"token-1").order).order;
 const confirmed=resolvePrintReview(uncertain,"confirm_printed","operator");
 assert.equal(confirmed.status,"printed");
 assert.equal(isPrintable(confirmed),false);
 assert.equal(claim(confirmed,"token-2").claimed,false);
});
test("explicit check allows retry only after human decision",()=>{
 const uncertain=onRestart(claim(paid,"token-1").order).order;
 const reviewed=resolvePrintReview(uncertain,"retry_after_check","operator");
 assert.equal(reviewed.status,"pending");
 assert.equal(reviewed.print_claim,null);
 assert.equal(reviewed.print_review.action,"retry_after_check");
 assert.equal(claim(reviewed,"token-2").claimed,true);
});
test("unpaid order cannot be claimed or manually bypassed",()=>{
 const unpaid={...paid,payment_status:"awaiting",payment_verified:false};
 assert.equal(claim(unpaid,"token-1").claimed,false);
 assert.throws(()=>resolvePrintReview(unpaid,"retry_after_check","operator"));
});
test("review requires a named operator and valid action",()=>{
 const uncertain=onRestart(claim(paid,"token-1").order).order;
 assert.throws(()=>resolvePrintReview(uncertain,"retry_after_check",""));
 assert.throws(()=>resolvePrintReview(uncertain,"retry","operator"));
});
