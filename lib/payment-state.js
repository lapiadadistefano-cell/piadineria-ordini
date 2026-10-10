"use strict";

// Only explicitly supported payment methods can enter the print queue.
// Unknown or missing methods require manual review, never an implicit cash fallback.
function isPrintable(order) {
  if (order?.status !== "pending") return false;
  if (order.payment_method === "cash") {
    // Cash is collected at pickup; contradictory payment claims must not pass silently.
    return order.payment_verified !== true && order.payment_status !== "paid";
  }
  if (order.payment_method === "mypos") {
    return order.payment_status === "paid" && order.payment_verified === true;
  }
  return false;
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
function simulatePrintOnce(order, now="2026-10-09T08:00:00.000Z") {
  if (!isPrintable(order)) return { printed: false, order };
  return { printed: true, order: { ...order, status: "printed", printed_at: now } };
}
module.exports = { isPrintable, createAwaitingPayment, confirmVerifiedPayment, simulatePrintOnce };
