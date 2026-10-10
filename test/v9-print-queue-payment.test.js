"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {toPrintQueue} = require("../lib/print-queue-adapter");
const {claim, acknowledge, onRestart} = require("../lib/print-recovery");
const base = {id:"LAB-PRINT-1",status:"pending",pickup_time:"12:45",customer_name:"Cliente prova",items:[{name:"Polpettosa",qty:1}],total:8};
test("cash ticket preserves method without paid marker",()=>{
 const q=toPrintQueue([{...base,payment_method:"cash",payment_status:"unpaid",payment_verified:false}]);
 assert.equal(q.length,1);
 assert.equal(q[0].payment_method,"cash");
 assert.equal(q[0].payment_verified,false);
});
test("verified myPOS ticket preserves verified status",()=>{
 const q=toPrintQueue([{...base,payment_method:"mypos",payment_status:"paid",payment_verified:true}]);
 assert.equal(q.length,1);
 assert.equal(q[0].payment_method,"mypos");
 assert.equal(q[0].payment_status,"paid");
 assert.equal(q[0].payment_verified,true);
});
test("unknown, missing, contradictory or unpaid payments never reach printer",()=>{
 const cases=[
  {...base},
  {...base,payment_method:"card"},
  {...base,payment_method:"cash",payment_status:"paid",payment_verified:true},
  {...base,payment_method:"mypos",payment_status:"awaiting",payment_verified:false},
  {...base,payment_method:"mypos",payment_status:"paid",payment_verified:false}
 ];
 assert.equal(toPrintQueue(cases).length,0);
});
test("claimed and interrupted orders cannot re-enter queue",()=>{
 const paid={...base,payment_method:"mypos",payment_status:"paid",payment_verified:true};
 const printing=claim(paid,"token").order;
 assert.equal(toPrintQueue([printing]).length,0);
 assert.equal(toPrintQueue([onRestart(printing).order]).length,0);
});

test("worker cannot claim an order with missing or invalid claim token",()=>{
 const order={...base,payment_method:"mypos",payment_status:"paid",payment_verified:true};
 for(const token of [""," ",null,42]){
  const result=claim(order,token);
  assert.equal(result.claimed,false);
  assert.equal(result.order.status,"pending");
 }
});

test("wrong acknowledgement token never marks a ticket printed",()=>{
 const paid={...base,payment_method:"mypos",payment_status:"paid",payment_verified:true};
 const printing=claim(paid,"worker-A").order;
 const wrong=acknowledge(printing,"worker-B");
 assert.equal(wrong.acknowledged,false);
 assert.equal(wrong.order.status,"printing");
 const right=acknowledge(printing,"worker-A");
 assert.equal(right.acknowledged,true);
 assert.equal(right.order.status,"printed");
 assert.equal(acknowledge(right.order,"worker-A").acknowledged,false);
});
test("interrupted printing requires review rather than automatic reprint",()=>{
 const paid={...base,payment_method:"mypos",payment_status:"paid",payment_verified:true};
 const printing=claim(paid,"worker-A").order;
 const recovered=onRestart(printing);
 assert.equal(recovered.needsReview,true);
 assert.equal(recovered.order.status,"print_review_required");
 assert.equal(claim(recovered.order,"worker-B").claimed,false);
 assert.equal(toPrintQueue([recovered.order]).length,0);
});
