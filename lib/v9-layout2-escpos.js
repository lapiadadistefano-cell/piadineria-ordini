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
    // CP858 supports common Italian accented letters on Rongta-compatible ESC/POS.
    const accents={"à":0x85,"è":0x8a,"é":0x82,"ì":0x8d,"ò":0x95,"ù":0x97,
      "À":0xb7,"È":0xd4,"É":0x90,"Ì":0xde,"Ò":0xe3,"Ù":0xeb,"€":0xd5};
    const bytes=[];
    for(const char of safe+"\n"){
      if(char==="\n"){bytes.push(10);continue;}
      if(Object.prototype.hasOwnProperty.call(accents,char)){bytes.push(accents[char]);continue;}
      const n=char.charCodeAt(0);
      if(n<32||n>126)throw Error("Unsupported ticket characters");
      bytes.push(n);
    }
    chunks.push(Buffer.from(bytes));
  };
  const align=n=>raw(ESC,0x61,n);
  const size=n=>raw(GS,0x21,n);
  const bold=n=>raw(ESC,0x45,n?1:0);
  raw(ESC,0x40);raw(ESC,0x74,0x13);align(1);bold(true);size(0x11);
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
