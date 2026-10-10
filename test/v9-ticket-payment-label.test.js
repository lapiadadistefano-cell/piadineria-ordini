"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {paymentLabel}=require("../lib/v9-ticket-payment-label");
const {toPrintQueue}=require("../lib/print-queue-adapter");
test("only verified myPOS is labelled paid",()=>{
 assert.equal(paymentLabel({payment_method:"mypos",payment_status:"paid",payment_verified:true}),"PAGATO MYPOS");
 for(const order of [
  {payment_method:"mypos",payment_status:"paid",payment_verified:false},
  {payment_method:"mypos",payment_status:"awaiting",payment_verified:false},
  {payment_method:"mypos",payment_status:"paid"},
  {payment_method:"unknown"},
  {}
 ]) assert.equal(paymentLabel(order),"PAGAMENTO DA VERIFICARE");
});
test("cash at pickup never claims myPOS payment",()=>{
 assert.equal(paymentLabel({payment_method:"cash",payment_status:"unpaid",payment_verified:false}),"DA PAGARE IN NEGOZIO");
 assert.equal(paymentLabel({payment_method:"cash",payment_status:"paid",payment_verified:true}),"PAGAMENTO DA VERIFICARE");
});
test("print queue passes exact payment fields for safe ticket label",()=>{
 const base={id:"LAB-1",status:"pending",total:8};
 const orders=[
  {...base,id:"LAB-CASH",payment_method:"cash",payment_status:"unpaid",payment_verified:false},
  {...base,id:"LAB-MYPOS",payment_method:"mypos",payment_status:"paid",payment_verified:true},
  {...base,id:"LAB-UNKNOWN",payment_method:"unknown"}
 ];
 const queue=toPrintQueue(orders);
 assert.deepEqual(queue.map(o=>paymentLabel(o)),["DA PAGARE IN NEGOZIO","PAGATO MYPOS"]);
});
