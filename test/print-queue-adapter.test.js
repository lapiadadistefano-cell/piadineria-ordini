"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {toPrintQueue}=require("../lib/print-queue-adapter");
const base={id:"FAKE-1",status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true,items:[{name:"Piadina",qty:1}],total:7,customer_name:"Cliente prova",phone:"000",print_token:"fake"};
test("only verified paid orders reach bridge queue",()=>{
 const unpaid={...base,id:"FAKE-2",payment_status:"awaiting",payment_verified:false,status:"awaiting_payment"};
 const forged={...base,id:"FAKE-3",payment_verified:false};
 const printed={...base,id:"FAKE-4",status:"printed"};
 const queue=toPrintQueue([unpaid,forged,printed,base]);
 assert.equal(queue.length,1);
 assert.equal(queue[0].id,"FAKE-1");
 assert.equal(queue[0].phone,undefined);
});
test("does not mutate input orders",()=>{
 const source=[base];
 const result=toPrintQueue(source);
 assert.equal(source[0].status,"pending");
 assert.notEqual(result[0],source[0]);
});
