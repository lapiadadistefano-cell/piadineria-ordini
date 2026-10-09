"use strict";
const { verifyNotification, amountInCents } = require("./mypos-security");
const { confirmVerifiedPayment } = require("./payment-state");

// Parse form data without accepting duplicate parameters or JSON callbacks.
// The exact incoming field order must be preserved for signature verification.
function parseNotification(body) {
  if (typeof body !== "string" || body.length > 20000) throw Error("Invalid notification body");
  const params = new URLSearchParams(body);
  const fields = Object.create(null);
  for (const [key, value] of params) {
    if (!key || Object.hasOwn(fields, key)) throw Error("Duplicate or empty field");
    fields[key] = value;
  }
  if (!Object.hasOwn(fields, "Signature")) throw Error("Missing signature");
  if (Array.from(params.keys()).at(-1) !== "Signature") throw Error("Signature must be last");
  return fields;
}

function processPurchaseNotify(order, fields, apiPublicKey, sandboxStoreId) {
  if (!order || fields.IPCmethod !== "IPCPurchaseNotify") throw Error("Unexpected notification");
  if (!sandboxStoreId || fields.SID !== sandboxStoreId) throw Error("Wrong store");
  if (!verifyNotification(fields, apiPublicKey)) throw Error("Invalid signature");
  if (!fields.IPC_Trnref || !fields.RequestSTAN) throw Error("Missing transaction identity");
  const cents = amountInCents(fields.Amount);
  if (cents === null) throw Error("Invalid amount");
  const paid = confirmVerifiedPayment(order, {
    signatureValid: true,
    reference: fields.OrderID,
    currency: fields.Currency,
    amountCents: cents,
    success: true
  });
  if (paid.payment_transaction_ref && paid.payment_transaction_ref !== fields.IPC_Trnref) {
    throw Error("Transaction reference mismatch");
  }
  return { ...paid, payment_transaction_ref: fields.IPC_Trnref };
}

module.exports = { parseNotification, processPurchaseNotify };
