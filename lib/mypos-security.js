"use strict";
const crypto = require("node:crypto");

// myPOS Checkout API v1.4: preserve the exact field order from the POST body.
// Never commit a private key or use the browser redirect as payment proof.
function canonicalMessage(fields) {
  const values = Object.entries(fields)
    .filter(([key]) => key !== "Signature")
    .map(([, value]) => String(value));
  return Buffer.from(values.join("-"), "utf8").toString("base64");
}
function signCheckout(fields, privateKey) {
  if (!privateKey) throw Error("Missing private key");
  return crypto.sign("RSA-SHA256", Buffer.from(canonicalMessage(fields)), privateKey).toString("base64");
}
function verifyNotification(fields, publicKey) {
  if (!publicKey || typeof fields.Signature !== "string") return false;
  let signature;
  try {
    signature = Buffer.from(fields.Signature, "base64");
    if (!signature.length) return false;
    return crypto.verify("RSA-SHA256", Buffer.from(canonicalMessage(fields)), publicKey, signature);
  } catch {
    return false;
  }
}
function amountInCents(amount) {
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, decimal = ""] = amount.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
module.exports = { canonicalMessage, signCheckout, verifyNotification, amountInCents };
