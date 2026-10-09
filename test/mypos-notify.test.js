"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { signCheckout } = require("../lib/mypos-security");
const { createAwaitingPayment, isPrintable } = require("../lib/payment-state");
const { parseNotification, processPurchaseNotify } = require("../lib/mypos-notify");

test("only valid signed myPOS notification unlocks printing", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const waiting = createAwaitingPayment({ id: "TEST-001", status: "pending", total: 8 }, "TEST-001");
  const fields = { IPCmethod: "IPCPurchaseNotify", SID: "000000000000010", Amount: "8.00", Currency: "EUR", OrderID: "TEST-001", IPC_Trnref: "TX-1", RequestSTAN: "000001" };
  const signed = { ...fields, Signature: signCheckout(fields, privateKey) };
  const raw = new URLSearchParams(signed).toString();
  assert.equal(isPrintable(waiting), false);
  const paid = processPurchaseNotify(waiting, parseNotification(raw), publicKey, "000000000000010");
  assert.equal(isPrintable(paid), true);
  assert.throws(() => processPurchaseNotify(waiting, parseNotification(new URLSearchParams({ ...signed, Amount: "9.00" }).toString()), publicKey, "000000000000010"));
  assert.throws(() => processPurchaseNotify(waiting, parseNotification(raw), publicKey, "OTHER-STORE"));
  assert.throws(() => parseNotification(raw + "&Amount=8.00"));
  assert.throws(() => parseNotification("IPCmethod=IPCPurchaseNotify&Signature=abc&OrderID=TEST-001"));
});
