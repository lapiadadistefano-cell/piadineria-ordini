"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {test}=require("node:test");
const {loadMyposConfigurationPackage}=require("../lib/mypos-config-package");
const {privateKey}=crypto.generateKeyPairSync("rsa",{modulusLength:2048});
const certPublic=crypto.createPublicKey(privateKey).export({type:"spki",format:"pem"});
const privatePem=privateKey.export({type:"pkcs8",format:"pem"});
const encode=obj=>Buffer.from(JSON.stringify(obj)).toString("base64");
const valid={sid:"1495244",cn:"40006270082",pk:privatePem,pc:certPublic,idx:1};
test("loads valid myPOS pack",()=>{
  const parsed=loadMyposConfigurationPackage(encode(valid));
  assert.equal(parsed.storeId,valid.sid);
  assert.equal(parsed.walletNumber,valid.cn);
  assert.equal(parsed.keyIndex,"1");
  assert.equal(parsed.privateKey,privatePem);
});
test("rejects malformed or incomplete packs",()=>{
  for(const v of ["", "not base64", encode({sid:"1"}), encode({...valid,idx:0}),encode({...valid,pk:"broken"})]){
    assert.throws(()=>loadMyposConfigurationPackage(v));
  }
});
