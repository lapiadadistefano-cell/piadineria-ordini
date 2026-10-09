"use strict";
// Pure adapter for future print bridge. No network, database mutation or printer I/O.
const { isPrintable } = require("./payment-state");
function toPrintQueue(orders) {
  if (!Array.isArray(orders)) throw Error("Invalid orders");
  return orders.filter(isPrintable).map(order => ({
    id: order.id,
    pickup_time: order.pickup_time,
    customer_name: order.customer_name,
    items: order.items,
    notes: order.notes,
    total: order.total,
    print_token: order.print_token,
    status: order.status
  }));
}
module.exports = { toPrintQueue };
