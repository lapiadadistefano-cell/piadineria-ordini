"use strict";
const {loadMyposConfigurationPackage}=require("./mypos-config-package");
const {signCheckout}=require("./mypos-security");
function buildLiveCheckout(order,origin,packageText){
  const config=loadMyposConfigurationPackage(packageText);
  if(order.status!=="awaiting_payment"||order.payment_method!=="mypos")throw Error("Not payable");
  if(!/^https:\/\/[-a-z0-9.]+$/i.test(origin))throw Error("HTTPS required");
  const amount=Number(order.total);
  if(!Number.isFinite(amount)||amount<=0)throw Error("Invalid total");
  const fields={
    IPCmethod:"IPCPurchase",IPCVersion:"1.4",IPCLanguage:"IT",
    SID:config.storeId,WalletNumber:config.walletNumber,
    Amount:amount.toFixed(2),Currency:"EUR",OrderID:String(order.payment_reference),
    URL_OK:origin+"/mypos/return",URL_Cancel:origin+"/mypos/cancel",
    URL_Notify:origin+"/api/mypos/notify",
    CardTokenRequest:"0",KeyIndex:config.keyIndex,PaymentParametersRequired:"3",
    CartItems:"1",Article_1:"Ordine La Piada di Stefano",Quantity_1:"1",
    Price_1:amount.toFixed(2),Currency_1:"EUR",Amount_1:amount.toFixed(2)
  };
  return {url:"https://www.mypos.com/vmp/checkout",fields:{...fields,Signature:signCheckout(fields,config.privateKey)}};
}
module.exports={buildLiveCheckout};
