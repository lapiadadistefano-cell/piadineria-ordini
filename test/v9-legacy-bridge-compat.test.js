"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {isPrintable,isLegacyBridgePrintable}=require("../lib/payment-state");
test("historical V8 pickup orders without payment_method remain printable on legacy bridge",()=>{
 const legacy={id:"V8-1",status:"pending"};
 assert.equal(isLegacyBridgePrintable(legacy),true);
 assert.equal(isPrintable(legacy),false);
});
test("legacy bridge does not expose unpaid or unknown explicit myPOS",()=>{
 for(const order of [
  {status:"pending",payment_method:"mypos",payment_status:"awaiting",payment_verified:false},
  {status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:false},
  {status:"printed"},
  {status:"cancelled"}
 ])assert.equal(isLegacyBridgePrintable(order),false);
});
test("strict V9 queue remains fail closed for missing method",()=>{
 assert.equal(isPrintable({status:"pending"}),false);
 assert.equal(isPrintable({status:"pending",payment_method:"cash"}),true);
 assert.equal(isPrintable({status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true}),true);
});
