"use strict";
// End-to-end in-memory scenario. No myPOS API, database, bridge, or printer calls.
const {createAwaitingPayment,confirmVerifiedPayment,isPrintable}=require("./payment-state");
const {toPrintQueue}=require("./print-queue-adapter");
const {claim,acknowledge,onRestart}=require("./print-recovery");
const {resolvePrintReview}=require("./print-review");
function runPrintLifecycleSimulation(){
 const original={id:"SIM-LIFECYCLE",status:"pending",total:7,items:[{name:"Piadina prova",qty:1}],print_token:"SIMULATED",customer_name:"Cliente prova"};
 const awaiting=createAwaitingPayment(original,"SIM-LIFECYCLE-PAYMENT");
 const beforePayment=toPrintQueue([awaiting]).length;
 const confirmation={signatureValid:true,reference:awaiting.payment_reference,currency:"EUR",amountCents:700,success:true};
 const paid=confirmVerifiedPayment(awaiting,confirmation);
 const afterPayment=toPrintQueue([paid]).length;
 const first=claim(paid,"worker-A");
 const competing=claim(first.order,"worker-B");
 const interrupted=onRestart(first.order);
 const blockedDuringReview=!isPrintable(interrupted.order);
 const reviewed=resolvePrintReview(interrupted.order,"retry_after_check","simulation-operator");
 const retry=claim(reviewed,"worker-C");
 const acknowledged=acknowledge(retry.order,"worker-C");
 const duplicatePayment=confirmVerifiedPayment(acknowledged.order,confirmation);
 const noDuplicateAfterCompletion=toPrintQueue([duplicatePayment]).length===0;
 return {simulationOnly:true,beforePayment,afterPayment,firstClaimAccepted:first.claimed,
  competingClaimBlocked:!competing.claimed,interruptionRequiresReview:interrupted.needsReview,
  blockedDuringReview,manualRetryAuthorized:retry.claimed,
  finalAcknowledged:acknowledged.acknowledged,finalStatus:acknowledged.order.status,
  noDuplicateAfterCompletion,noPrinterConnected:true};
}
module.exports={runPrintLifecycleSimulation};
