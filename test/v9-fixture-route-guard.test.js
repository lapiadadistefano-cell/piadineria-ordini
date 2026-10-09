"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
test("V9 fixture endpoint is key-protected, sandbox-only, fixed-reference",()=>{
 const server=fs.readFileSync(require("node:path").join(__dirname,"../server.js"),"utf8");
 const start=server.indexOf('if(req.method==="POST"&&u.pathname==="/api/v9-lab/create-review-fixture")');
 const end=server.indexOf('if(req.method==="POST"&&u.pathname==="/api/v9-lab/resolve-review")',start);
 assert.ok(start>0&&end>start);
 const route=server.slice(start,end);
 assert.match(route,/!MYPOS_SANDBOX\|\|!sandboxStore/);
 assert.match(route,/!isAuthorizedLabRequest\(req,process\.env\)/);
 assert.match(route,/b\.reference!=="LAB-001"/);
 assert.match(route,/sandboxStore\.createLabReview\("LAB-001"\)/);
 assert.doesNotMatch(route,/printer\.write|printBridge|sendToPrinter/);
});
