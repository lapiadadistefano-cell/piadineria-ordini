"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {signCheckout}=require("../lib/mypos-security");
const {parseNotification,validatePaymentNotification}=require("../lib/mypos-production-notify");
const {buildLiveCheckout}=require("../lib/mypos-live-checkout");
const keys=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const privateKey=keys.privateKey.export({type:"pkcs8",format:"pem"});
const publicKey=keys.publicKey.export({type:"spki",format:"pem"});
const pack=Buffer.from(JSON.stringify({sid:"1495244",cn:"40006270082",idx:1,pk:privateKey,pc:publicKey})).toString("base64");
const order={id:"20261010-001",payment_reference:"20261010-001",status:"awaiting_payment",payment_method:"mypos",total:8};
test("checkout uses signed production endpoint and correct amount",()=>{
 const checkout=buildLiveCheckout(order,"https://example.com",pack);
 assert.equal(checkout.url,"https://www.mypos.com/vmp/checkout");
 assert.equal(checkout.fields.Amount,"8.00");
 assert.ok(checkout.fields.Signature);
});
test("valid signed callback is accepted",()=>{
 const fields={IPCmethod:"IPCPurchaseNotify",SID:"1495244",Amount:"8.00",Currency:"EUR",OrderID:"20261010-001",IPC_Trnref:"ref1",RequestSTAN:"stan1"};
 fields.Signature=signCheckout(fields,privateKey);
 const body=new URLSearchParams(fields).toString();
 assert.deepEqual(validatePaymentNotification(parseNotification(body),pack),{reference:"20261010-001",transactionRef:"ref1",amountCents:800});
});
test("tampering with payment amount invalidates signature",()=>{
 const fields={IPCmethod:"IPCPurchaseNotify",SID:"1495244",Amount:"8.00",Currency:"EUR",OrderID:"20261010-001",IPC_Trnref:"ref1",RequestSTAN:"stan1"};
 fields.Signature=signCheckout(fields,privateKey);
 fields.Amount="80.00";
 assert.throws(()=>validatePaymentNotification(fields,pack),/signature/);
});
test("duplicate callback parameters are rejected",()=>{
 assert.throws(()=>parseNotification("SID=1&SID=2&Signature=x"),/Duplicate/);
});

test("callback rejects a different store even with valid signature",()=>{
 const fields={IPCmethod:"IPCPurchaseNotify",SID:"999999",Amount:"8.00",Currency:"EUR",OrderID:"20261010-001",IPC_Trnref:"ref1",RequestSTAN:"stan1"};
 fields.Signature=signCheckout(fields,privateKey);
 assert.throws(()=>validatePaymentNotification(parseNotification(new URLSearchParams(fields).toString()),pack),/store/);
});
test("callback rejects a different currency even with valid signature",()=>{
 const fields={IPCmethod:"IPCPurchaseNotify",SID:"1495244",Amount:"8.00",Currency:"USD",OrderID:"20261010-001",IPC_Trnref:"ref1",RequestSTAN:"stan1"};
 fields.Signature=signCheckout(fields,privateKey);
 assert.throws(()=>validatePaymentNotification(parseNotification(new URLSearchParams(fields).toString()),pack),/currency/);
});
test("callback rejects unsigned and misplaced signatures",()=>{
 assert.throws(()=>parseNotification("SID=1495244"),/signature/);
 assert.throws(()=>parseNotification("Signature=x&SID=1495244"),/last/);
});
test("checkout refuses an already paid order",()=>{
 assert.throws(()=>buildLiveCheckout({...order,status:"pending"},"https://example.com",pack),/Not payable/);
});
