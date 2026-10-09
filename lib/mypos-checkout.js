"use strict";
const { signCheckout } = require("./mypos-security");

const SANDBOX_URL = "https://www.mypos.com/vmp/checkout-test";
const SANDBOX_STORE = "000000000000010";
const SANDBOX_WALLET = "61938166610";

function buildSandboxCheckout({ order, baseUrl, privateKey }) {
  if (!order || order.payment_method !== "mypos" || order.status !== "awaiting_payment") {
    throw Error("Order must be awaiting myPOS payment");
  }
  if (!/^https:\/\/[^/]+$/.test(baseUrl || "")) throw Error("HTTPS base URL required");
  if (!privateKey) throw Error("Sandbox signing key required");
  const total = Number(order.total);
  if (!Number.isFinite(total) || total <= 0 || Math.round(total * 100) !== total * 100) {
    throw Error("Invalid order total");
  }
  const amount = total.toFixed(2);
  // Insertion order is part of the RSA signature.
  const fields = {
    IPCmethod: "IPCPurchase",
    IPCVersion: "1.4",
    IPCLanguage: "IT",
    SID: SANDBOX_STORE,
    WalletNumber: SANDBOX_WALLET,
    Amount: amount,
    Currency: "EUR",
    OrderID: String(order.payment_reference),
    URL_OK: baseUrl + "/mypos/return",
    URL_Cancel: baseUrl + "/mypos/cancel",
    URL_Notify: baseUrl + "/api/mypos/notify",
    CardTokenRequest: "0",
    KeyIndex: "1",
    PaymentParametersRequired: "0",
    CartItems: "1",
    Article_1: "Ordine La Piada di Stefano",
    Quantity_1: "1",
    Price_1: amount,
    Currency_1: "EUR",
    Amount_1: amount
  };
  return { url: SANDBOX_URL, fields: { ...fields, Signature: signCheckout(fields, privateKey) } };
}

module.exports = { buildSandboxCheckout, SANDBOX_URL };
