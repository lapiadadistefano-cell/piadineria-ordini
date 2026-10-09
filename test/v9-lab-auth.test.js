"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {isAuthorizedLabRequest}=require("../lib/v9-lab-auth");
const key="sandbox-v9-only-"+ "x".repeat(48);
const env={MYPOS_STAGING_ONLY:"true",MYPOS_SANDBOX_ENABLED:"true",V9_LAB_READ_KEY:key};
test("V9 lab access fails closed without configured key",()=>{
 assert.equal(isAuthorizedLabRequest({headers:{}},{...env,V9_LAB_READ_KEY:undefined}),false);
 assert.equal(isAuthorizedLabRequest({headers:{"x-v9-lab-key":key}},{...env,V9_LAB_READ_KEY:"short"}),false);
});
test("V9 lab rejects wrong or old bridge credentials",()=>{
 assert.equal(isAuthorizedLabRequest({headers:{"x-api-key":key}},env),false);
 assert.equal(isAuthorizedLabRequest({headers:{"x-v9-lab-key":"wrong"}},env),false);
});
test("V9 lab works only in sandbox with separate matching key",()=>{
 assert.equal(isAuthorizedLabRequest({headers:{"x-v9-lab-key":key}},env),true);
 assert.equal(isAuthorizedLabRequest({headers:{"x-v9-lab-key":key}},{...env,MYPOS_STAGING_ONLY:"false"}),false);
 assert.equal(isAuthorizedLabRequest({headers:{"x-v9-lab-key":key}},{...env,MYPOS_SANDBOX_ENABLED:"false"}),false);
});
