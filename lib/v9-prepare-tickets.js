"use strict";
// Offline V9 print preparation: eligible orders -> ESC/POS bytes, no network/printer I/O.
const {toPrintQueue}=require("./print-queue-adapter");
const {encodeTicket}=require("./v9-layout2-escpos");
function prepareTickets(orders){
  return toPrintQueue(orders).map(order=>({
    id:order.id,
    print_token:order.print_token,
    bytes:encodeTicket(order)
  }));
}
module.exports={prepareTickets};
