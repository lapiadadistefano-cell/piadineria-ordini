"use strict";
// Offline V9 print preparation: eligible orders -> ESC/POS bytes, no network/printer I/O.
const {toPrintQueue}=require("./print-queue-adapter");
const {encodeTicket}=require("./v9-layout2-escpos");
function prepareTickets(orders){
  const queue=toPrintQueue(orders);
  const seen=new Set();
  const seenTokens=new Set();
  for(const order of queue){
    if(typeof order.id!=="string"||!order.id.trim()||seen.has(order.id))throw Error("Invalid or duplicate ticket ID");
    seen.add(order.id);
    if(typeof order.print_token!=="string"||!order.print_token.trim()||seenTokens.has(order.print_token))throw Error("Missing or duplicate print token");
    seenTokens.add(order.print_token);
  }
  return queue.map(order=>({
    id:order.id,
    print_token:order.print_token,
    bytes:encodeTicket(order)
  }));
}
module.exports={prepareTickets};
