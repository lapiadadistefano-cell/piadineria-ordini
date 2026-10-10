"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {prepareTickets}=require("../lib/v9-prepare-tickets");
const base={id:"LAB-01",status:"pending",pickup_time:"12:30",customer_name:"CLIENTE",items:[{name:"POLPETTOSA",qty:1,changes:"SENZA RUCOLA"}],notes:"RITIRO AL BANCO",total:8,print_token:"lab-token"};
test("V9 offline queue creates one binary ticket and preserves notes",()=>{
 const jobs=prepareTickets([{...base,payment_method:"cash",payment_status:"unpaid",payment_verified:false}]);
 assert.equal(jobs.length,1);
 assert.equal(jobs[0].print_token,"lab-token");
 assert.ok(Buffer.isBuffer(jobs[0].bytes));
 assert.ok(jobs[0].bytes.toString("latin1").includes("NOTE ORDINE: RITIRO AL BANCO"));
});
test("verified myPOS and cash print, unverified orders do not",()=>{
 const jobs=prepareTickets([
  {...base,id:"CASH",payment_method:"cash"},
  {...base,id:"MYPOS",payment_method:"mypos",payment_status:"paid",payment_verified:true},
  {...base,id:"WAIT",payment_method:"mypos",payment_status:"awaiting",payment_verified:false},
  {...base,id:"UNKNOWN",payment_method:"other"}
 ]);
 assert.deepEqual(jobs.map(x=>x.id),["CASH","MYPOS"]);
 assert.ok(jobs[0].bytes.toString("latin1").includes("DA PAGARE IN NEGOZIO"));
 assert.ok(jobs[1].bytes.toString("latin1").includes("PAGATO MYPOS"));
});
test("invalid printable ticket aborts preparation rather than sending partial jobs",()=>{
 assert.throws(()=>prepareTickets([{...base,payment_method:"cash",items:[{name:"INVALID",qty:0}]}]));
});
