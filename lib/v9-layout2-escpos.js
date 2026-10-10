"use strict";
// Offline V9 Layout 2 ESC/POS encoder: returns bytes, never opens printer/network.
const {paymentLabel}=require("./v9-ticket-payment-label");
const {isPrintable}=require("./payment-state");
const ESC=0x1b,GS=0x1d;
function encodeTicket(order){
  if(!isPrintable(order))throw Error("Order not eligible for V9 printing");
  if(!Array.isArray(order.items)||!order.items.length)throw Error("Missing ticket items");
  const chunks=[];
  const raw=(...bytes)=>chunks.push(Buffer.from(bytes));
  const line=(value="")=>{
    const safe=String(value).replace(/[\x00-\x1f\x7f]/g," ").trim();
    // CP858 for accented glyphs requires a separate printer-specific mapping.
    // Reject rather than silently corrupting ingredient changes.
    if(!/^[\x20-\x7e]*$/.test(safe))throw Error("Unsupported ticket characters");
    chunks.push(Buffer.from(safe+"\n","ascii"));
  };
  const align=n=>raw(ESC,0x61,n);
  const size=n=>raw(GS,0x21,n);
  const bold=n=>raw(ESC,0x45,n?1:0);
  raw(ESC,0x40);align(1);bold(true);size(0x11);
  line("ORDINE "+String(order.id??"").replace(/[^\x20-\x7e]/g,""));
  line("RITIRO "+String(order.pickup_time??""));
  size(0);line(paymentLabel(order));bold(false);line("");
  align(0);line("CLIENTE: "+String(order.customer_name??""));
  line("--------------------------------");
  for(const item of order.items){
    const qty=Number(item.qty);
    if(!Number.isInteger(qty)||qty<1||qty>20)throw Error("Invalid item quantity");
    size(0x10);bold(true);line(qty+" x "+item.name);size(0);
    if(item.changes){bold(true);line("MODIFICA: "+item.changes);bold(false);}
    line("");
  }
  if(order.notes){bold(true);line("NOTE ORDINE: "+order.notes);bold(false);}
  line("--------------------------------");
  bold(true);size(0x10);
  const total=Number(order.total);
  if(!Number.isFinite(total)||total<0)throw Error("Invalid total");
  line("TOTALE EUR "+total.toFixed(2).replace(".",","));
  size(0);bold(false);raw(0x0a,0x0a);
  raw(GS,0x56,0x42,0x00);
  return Buffer.concat(chunks);
}
module.exports={encodeTicket};
