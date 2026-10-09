"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {runPrintLifecycleSimulation}=require("../lib/print-lifecycle-simulation");
test("full paid-order lifecycle blocks duplicate printing and handles interruption",()=>{
 const r=runPrintLifecycleSimulation();
 assert.deepEqual(r,{
  simulationOnly:true,beforePayment:0,afterPayment:1,firstClaimAccepted:true,
  competingClaimBlocked:true,interruptionRequiresReview:true,blockedDuringReview:true,
  manualRetryAuthorized:true,finalAcknowledged:true,finalStatus:"printed",
  noDuplicateAfterCompletion:true,noPrinterConnected:true
 });
});
