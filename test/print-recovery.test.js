"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {claim,acknowledge,onRestart}=require("../lib/print-recovery");
const {isPrintable}=require("../lib/payment-state");
const order={id:"TEST-1",status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true};
test("unpaid order cannot be claimed",()=>{
 const unpaid={...order,payment_verified:false};
 assert.equal(claim(unpaid,"worker-a").claimed,false);
});
test("claim prevents another print attempt",()=>{
 const first=claim(order,"worker-a");
 assert.equal(first.claimed,true);
 assert.equal(isPrintable(first.order),false);
 assert.equal(claim(first.order,"worker-b").claimed,false);
 assert.equal(acknowledge(first.order,"worker-b").acknowledged,false);
 const done=acknowledge(first.order,"worker-a");
 assert.equal(done.acknowledged,true);
 assert.equal(claim(done.order,"worker-a").claimed,false);
});
test("restart before acknowledgement requires review, not automatic reprint",()=>{
 const first=claim(order,"worker-a");
 const recovered=onRestart(first.order);
 assert.equal(recovered.needsReview,true);
 assert.equal(recovered.order.status,"print_review_required");
 assert.equal(isPrintable(recovered.order),false);
 assert.equal(claim(recovered.order,"worker-b").claimed,false);
});
test("already acknowledged print stays printed after restart",()=>{
 const printed=acknowledge(claim(order,"worker-a").order,"worker-a").order;
 assert.equal(onRestart(printed).needsReview,false);
 assert.equal(printed.status,"printed");
});

test("simulated queue polling hides claimed and interrupted orders",()=>{
 const {toPrintQueue}=require("../lib/print-queue-adapter");
 const waiting={...order,id:"WAIT",status:"awaiting_payment",payment_status:"awaiting",payment_verified:false};
 assert.deepEqual(toPrintQueue([waiting,order]).map(x=>x.id),["TEST-1"]);
 const active=claim(order,"worker-a").order;
 assert.equal(toPrintQueue([active]).length,0);
 const interrupted=onRestart(active).order;
 assert.equal(toPrintQueue([interrupted]).length,0);
});
test("simulated acknowledgement leaves no repeatable print jobs",()=>{
 const {toPrintQueue}=require("../lib/print-queue-adapter");
 const active=claim(order,"worker-a").order;
 const done=acknowledge(active,"worker-a").order;
 assert.equal(toPrintQueue([done]).length,0);
 assert.equal(acknowledge(done,"worker-a").acknowledged,false);
});
