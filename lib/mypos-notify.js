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

module.exports={parseNotification};
