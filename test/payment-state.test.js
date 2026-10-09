"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { isPrintable, createAwaitingPayment, confirmVerifiedPayment } = require("../lib/payment-state");

const original = { id: "TEST-001", status: "pending", total: 8 };
test("ordinary pickup orders remain printable", () => {
  assert.equal(isPrintable(original), true);
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
