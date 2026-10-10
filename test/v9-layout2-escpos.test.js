"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {encodeTicket}=require("../lib/v9-layout2-escpos");
const paid={id:"025",status:"pending",pickup_time:"12:45",customer_name:"MARCO",items:[{name:"POLPETTOSA",qty:1,changes:"SENZA RUCOLA"},{name:"MEDITERRANEA",qty:1}],total:16,payment_method:"mypos",payment_status:"paid",payment_verified:true};
test("V9 ticket is ESC/POS with paid label, changes and cutter",()=>{
 const bin=encodeTicket(paid);
 assert.deepEqual([...bin.subarray(0,2)],[27,64]);
 assert.deepEqual([...bin.subarray(-4)],[29,86,66,0]);
 const text=bin.toString("latin1");
 for(const word of ["ORDINE 025","RITIRO 12:45","PAGATO MYPOS","POLPETTOSA","MODIFICA: SENZA RUCOLA","MEDITERRANEA","TOTALE EUR 16,00"])assert.ok(text.includes(word),word);
});
test("cash ticket says pay in shop, not paid",()=>{
 const bin=encodeTicket({...paid,payment_method:"cash",payment_status:"unpaid",payment_verified:false});
 assert.ok(bin.toString("latin1").includes("DA PAGARE IN NEGOZIO"));
 assert.ok(!bin.toString("latin1").includes("PAGATO MYPOS"));
});
test("unverified myPOS and unknown method cannot generate a ticket",()=>{
 for(const order of [
  {...paid,payment_verified:false},
  {...paid,payment_method:"unknown"},
  {...paid,status:"printed"}
 ])assert.throws(()=>encodeTicket(order),/not eligible/);
});
test("invalid quantities, missing items and totals fail closed",()=>{
 assert.throws(()=>encodeTicket({...paid,items:[]}));
 assert.throws(()=>encodeTicket({...paid,items:[{name:"P",qty:0}]}));
 assert.throws(()=>encodeTicket({...paid,total:NaN}));
});

test("Italian accented customer and ingredient text is encoded without replacement",()=>{
 const ticket=encodeTicket({...paid,customer_name:"NICOLÒ",items:[{name:"PIADINA",qty:1,changes:"PIÙ FORMAGGIO"}],notes:"CITTÀ"});
 assert.ok(ticket.includes(Buffer.from([0xe3])),"uppercase accented O");
 assert.ok(ticket.includes(Buffer.from([0xeb])),"uppercase accented U");
 assert.ok(ticket.includes(Buffer.from([0xb7])),"uppercase accented A");
});
test("unsupported glyphs fail closed before physical printing",()=>{
 assert.throws(()=>encodeTicket({...paid,customer_name:"CLIENTE 😀"}),/Unsupported ticket characters/);
});
