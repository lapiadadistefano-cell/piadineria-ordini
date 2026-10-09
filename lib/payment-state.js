"use strict";

// Pure payment-state transitions; never expose an unpaid order to the print bridge.
function isPrintable(order) {
  return order?.status === "pending" && (
    order.payment_method !== "mypos" ||
    (order.payment_status === "paid" && order.payment_verified === true)
  );
}

function createAwaitingPayment(order, checkoutReference) {
  if (!order || !checkoutReference || order.status === "printed") throw Error("Invalid payment order");
  return {
    ...order,
    status: "awaiting_payment",
    payment_method: "mypos",
    payment_status: "awaiting",
    payment_verified: false,
    payment_reference: String(checkoutReference)
  };
}

function confirmVerifiedPayment(order, confirmation) {
  if (!order || order.payment_method !== "mypos" || !confirmation?.signatureValid) throw Error("Payment not verified");
  if (confirmation.reference !== order.payment_reference) throw Error("Payment reference mismatch");
  if (confirmation.currency !== "EUR" || !Number.isInteger(confirmation.amountCents) ||
      confirmation.amountCents !== Math.round(order.total * 100)) throw Error("Payment amount mismatch");
  if (confirmation.success !== true) throw Error("Payment not successful");
  if (order.payment_status === "paid" && order.payment_verified === true) return order;
  if (order.status !== "awaiting_payment" || order.payment_status !== "awaiting") throw Error("Invalid payment state");
  return { ...order, status: "pending", payment_status: "paid", payment_verified: true,
    payment_confirmed_at: new Date().toISOString() };
}
module.exports = { isPrintable, createAwaitingPayment, confirmVerifiedPayment };
