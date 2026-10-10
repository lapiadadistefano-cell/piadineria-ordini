"use strict";
const {verifyNotification,amountInCents}=require("./mypos-security");
const {loadMyposConfigurationPackage}=require("./mypos-config-package");
const {parseNotification}=require("./mypos-notify");
function validatePaymentNotification(fields,packageText){
  const config=loadMyposConfigurationPackage(packageText);
  if(!fields||typeof fields!=="object"||Array.isArray(fields))throw Error("Invalid callback");
  if(!verifyNotification(fields,config.apiPublicCertificate))throw Error("Invalid callback signature");
  if(String(fields.SID)!==config.storeId)throw Error("Invalid store");
  if(fields.Currency!=="EUR")throw Error("Invalid currency");
  const amountCents=amountInCents(fields.Amount);
  if(amountCents===null||amountCents<=0)throw Error("Invalid amount");
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(String(fields.OrderID||"")))throw Error("Invalid order");
  if(!fields.IPC_Trnref||typeof fields.IPC_Trnref!=="string")throw Error("Missing transaction");
  if(String(fields.IPCmethod)!=="IPCPurchaseNotify")throw Error("Invalid method");
  if(!fields.RequestSTAN)throw Error("Missing transaction request identity");
  if(String(fields.IPC_Trnref).length>128)throw Error("Invalid transaction");
  return {reference:String(fields.OrderID),transactionRef:fields.IPC_Trnref,amountCents};
}
module.exports={validatePaymentNotification,parseNotification};
