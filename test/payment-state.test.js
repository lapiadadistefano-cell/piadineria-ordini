"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { isPrintable, createAwaitingPayment, confirmVerifiedPayment, simulatePrintOnce } = require("../lib/payment-state");

const original = { id: "TEST-001", status: "pending", total: 8, payment_method: "cash" };
test("ordinary cash pickup orders remain printable", () => {
  assert.equal(isPrintable(original), true);
});
test("missing, unknown, or contradictory payment methods never enter print queue", () => {
  assert.equal(isPrintable({...original,payment_method:undefined}), false);
  assert.equal(isPrintable({...original,payment_method:"card"}), false);
  assert.equal(isPrintable({...original,payment_method:"bank_transfer"}), false);
  assert.equal(isPrintable({...original,payment_method:"CASH"}), false);
  assert.equal(isPrintable({...original,payment_verified:true}), false);
  assert.equal(isPrintable({...original,payment_status:"paid"}), false);
  assert.equal(isPrintable({...original,payment_method:"mypos",payment_status:"paid",payment_verified:false}), false);
});
test("myPOS orders cannot print until server-verified confirmation", () => {
  const waiting = createAwaitingPayment(original, "CHECKOUT-001");
  assert.equal(isPrintable(waiting), false);
  assert.equal(waiting.payment_status, "awaiting");
  const valid = { signatureValid: true, reference: "CHECKOUT-001", currency: "EUR", amountCents: 800, success: true };
  assert.throws(() => confirmVerifiedPayment(waiting, { ...valid, signatureValid: false }));
  assert.throws(() => confirmVerifiedPayment(waiting, { ...valid, amountCents: 900 }));
  assert.throws(() => confirmVerifiedPayment(waiting, { ...valid, reference: "OTHER" }));
  assert.throws(() => confirmVerifiedPayment(waiting, { ...valid, success: false }));
  const paid = confirmVerifiedPayment(waiting, valid);
  assert.equal(isPrintable(paid), true);
  assert.deepEqual(confirmVerifiedPayment(paid, valid), paid);
});
test("verified paid orders print once and never become printable again", () => {
  const waiting = createAwaitingPayment(original, "CHECKOUT-PRINT-001");
  const valid = { signatureValid: true, reference: "CHECKOUT-PRINT-001", currency: "EUR", amountCents: 800, success: true };
  assert.equal(isPrintable(waiting), false);
  const paid = confirmVerifiedPayment(waiting, valid);
  assert.equal(isPrintable(paid), true);
  const printed = { ...paid, status: "printed", printed_at: new Date().toISOString() };
  assert.equal(isPrintable(printed), false);
  assert.deepEqual(confirmVerifiedPayment(printed, valid), printed, "duplicate signed notification cannot requeue a printed order");
  assert.equal(isPrintable(confirmVerifiedPayment(printed, valid)), false);
});
test("forged payment state or unrelated status never prints", () => {
  const waiting = createAwaitingPayment(original, "CHECKOUT-PRINT-002");
  assert.equal(isPrintable({ ...waiting, status: "pending", payment_status: "awaiting" }), false);
  assert.equal(isPrintable({ ...waiting, status: "pending", payment_status: "paid", payment_verified: false }), false);
  assert.equal(isPrintable({ ...waiting, status: "cancelled", payment_status: "paid", payment_verified: true }), false);
});
test("sandbox simulation never prints an unpaid order", () => {
  const waiting = createAwaitingPayment(original, "SIM-UNPAID");
  const first = simulatePrintOnce(waiting);
  assert.equal(first.printed, false);
  assert.deepEqual(first.order, waiting);
});
test("sandbox simulation prints a verified payment exactly once", () => {
  const waiting = createAwaitingPayment(original, "SIM-PAID");
  const confirmation = { signatureValid: true, reference: "SIM-PAID", currency: "EUR", amountCents: 800, success: true };
  const paid = confirmVerifiedPayment(waiting, confirmation);
  const first = simulatePrintOnce(paid);
  assert.equal(first.printed, true);
  assert.equal(first.order.status, "printed");
  const second = simulatePrintOnce(first.order);
  assert.equal(second.printed, false);
  assert.deepEqual(second.order, first.order);
  const duplicateCallback = confirmVerifiedPayment(first.order, confirmation);
  assert.equal(simulatePrintOnce(duplicateCallback).printed, false);
});

test("checkout cannot reopen printing, printed, cancelled or review orders",()=>{
 for(const status of ["printing","printed","cancelled","print_review_required","awaiting_payment"]){
  assert.throws(()=>createAwaitingPayment({...original,status},"CHECKOUT-NEW"),/Invalid payment order/);
 }
 for(const ref of ["",null,42])assert.throws(()=>createAwaitingPayment(original,ref),/Invalid payment order/);
 for(const paid of [{payment_status:"paid"},{payment_verified:true}])assert.throws(()=>createAwaitingPayment({...original,...paid},"CHECKOUT-NEW"),/Invalid payment order/);
 for(const total of [-1,NaN,Infinity])assert.throws(()=>createAwaitingPayment({...original,total},"CHECKOUT-NEW"),/Invalid payment order/);
});

test("cash orders with contradictory or unknown payment states are held",()=>{
 for(const payment_status of ["awaiting","failed","refunded","paid","unknown"]){
  assert.equal(isPrintable({...original,payment_status}),false,payment_status);
 }
 assert.equal(isPrintable({...original,payment_status:"unpaid",payment_verified:false}),true);
 assert.equal(isPrintable({...original,payment_status:"unpaid",payment_verified:"yes"}),false);
});
