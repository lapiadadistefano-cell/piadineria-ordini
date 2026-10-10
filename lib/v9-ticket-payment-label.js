"use strict";
// Pure ticket label selector for V9 Layout 2. No printer or payment I/O.
// Only a server-verified myPOS payment may be labelled paid.
function paymentLabel(order) {
  if (order?.payment_method === "mypos" &&
      order.payment_status === "paid" && order.payment_verified === true) {
    return "PAGATO MYPOS";
  }
  if (order?.payment_method === "cash" &&
      (order.payment_verified === false || order.payment_verified == null) &&
      (order.payment_status == null || order.payment_status === "unpaid")) {
    return "DA PAGARE IN NEGOZIO";
  }
  return "PAGAMENTO DA VERIFICARE";
}
module.exports = {paymentLabel};
