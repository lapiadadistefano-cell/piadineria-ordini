"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { buildSandboxCheckout, SANDBOX_URL } = require("../lib/mypos-checkout");
const { verifyNotification } = require("../lib/mypos-security");
const { createAwaitingPayment } = require("../lib/payment-state");

const order = createAwaitingPayment({ id: "TEST-1", status: "pending", total: 8 }, "TEST-1");
test("checkout request is signed and targets only sandbox", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const result = buildSandboxCheckout({ order, baseUrl: "https://staging.example.org", privateKey });
  assert.equal(result.url, SANDBOX_URL);
  assert.equal(result.fields.Amount, "8.00");
  assert.equal(result.fields.Currency, "EUR");
  assert.equal(result.fields.URL_Notify, "https://staging.example.org/api/mypos/notify");
  assert.equal(verifyNotification(result.fields, publicKey), true);
});
test("checkout rejects unsafe inputs and never accepts live URLs", () => {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const args = { order, baseUrl: "https://staging.example.org", privateKey };
  assert.throws(() => buildSandboxCheckout({ ...args, baseUrl: "http://localhost:3000" }));
  assert.throws(() => buildSandboxCheckout({ ...args, order: { ...order, total: -1 } }));
  assert.throws(() => buildSandboxCheckout({ ...args, order: { ...order, status: "pending" } }));
  assert.throws(() => buildSandboxCheckout({ ...args, privateKey: "" }));
});
