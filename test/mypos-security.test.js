"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { signCheckout, verifyNotification, amountInCents } = require("../lib/mypos-security");

test("signed myPOS fields verify, tampered fields do not", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const fields = { IPCmethod: "IPCPurchase", Amount: "8.00", Currency: "EUR", OrderID: "TEST-001" };
  const signed = { ...fields, Signature: signCheckout(fields, privateKey) };
  assert.equal(verifyNotification(signed, publicKey), true);
  assert.equal(verifyNotification({ ...signed, Amount: "80.00" }, publicKey), false);
  assert.equal(verifyNotification({ ...signed, Signature: "invalid" }, publicKey), false);
  assert.equal(verifyNotification(fields, publicKey), false);
});
test("amount validation uses exact cents", () => {
  assert.equal(amountInCents("8.00"), 800);
  assert.equal(amountInCents("8.5"), 850);
  assert.equal(amountInCents("8.999"), null);
  assert.equal(amountInCents("-1.00"), null);
});
