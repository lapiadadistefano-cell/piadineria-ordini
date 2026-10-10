"use strict";
// Models the unavoidable uncertainty between physical printing and its acknowledgement.
// This module performs no I/O and cannot send anything to a real printer.
const {isPrintable}=require("./payment-state");
function claim(order,token,now="2026-10-09T09:00:00.000Z"){
 if(!isPrintable(order)||typeof token!=="string"||!token.trim())return {claimed:false,order};
 return {claimed:true,order:{...order,status:"printing",print_claim:token,print_claimed_at:now}};
}
function acknowledge(order,token,now="2026-10-09T09:01:00.000Z"){
 if(order?.status!=="printing"||order.print_claim!==token)return {acknowledged:false,order};
 return {acknowledged:true,order:{...order,status:"printed",printed_at:now}};
}
function onRestart(order){
 if(order?.status!=="printing")return {needsReview:false,order};
 // Never blindly retry: physical printing might have completed before the crash.
 return {needsReview:true,order:{...order,status:"print_review_required"}};
}
module.exports={claim,acknowledge,onRestart};
