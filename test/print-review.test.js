"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {resolvePrintReview}=require("../lib/print-review");
const {claim,onRestart}=require("../lib/print-recovery");
const {isPrintable}=require("../lib/payment-state");
const original={id:"SIM-REVIEW",status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true};
const interrupted=onRestart(claim(original,"worker-one").order).order;
test("ambiguous order stays unprintable until manual decision",()=>{
 assert.equal(isPrintable(interrupted),false);
 assert.throws(()=>resolvePrintReview(interrupted,"retry_after_check",""));
 assert.throws(()=>resolvePrintReview(interrupted,"unknown","operator"));
 assert.equal(interrupted.status,"print_review_required");
});
test("operator confirms paper printed without retry",()=>{
 const result=resolvePrintReview(interrupted,"confirm_printed","operatore");
 assert.equal(result.status,"printed");
 assert.equal(isPrintable(result),false);
 assert.equal(result.print_review.action,"confirm_printed");
});
test("operator can explicitly retry after checking no paper was produced",()=>{
 const result=resolvePrintReview(interrupted,"retry_after_check","operatore");
 assert.equal(result.status,"pending");
 assert.equal(isPrintable(result),true);
 assert.equal(result.print_claim,null);
 assert.equal(result.print_review.action,"retry_after_check");
});
test("cannot resolve an order that is not under review",()=>{
 assert.throws(()=>resolvePrintReview(original,"confirm_printed","operatore"));
});
