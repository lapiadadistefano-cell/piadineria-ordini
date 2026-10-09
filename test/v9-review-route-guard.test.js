"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
test("V9 manual review endpoint is sandbox-only and key protected",()=>{
 const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
 const start=server.indexOf('if(req.method==="POST"&&u.pathname==="/api/v9-lab/resolve-review")');
 assert.ok(start>0);
 const end=server.indexOf('if(req.method==="GET"&&u.pathname==="/api/v9-lab/status")',start);
 assert.ok(end>start);
 const route=server.slice(start,end);
 assert.match(route,/!MYPOS_SANDBOX\|\|!sandboxStore/);
 assert.match(route,/!isAuthorizedLabRequest\(req,process\.env\)/);
 assert.match(route,/sandboxStore\.resolvePrintReview/);
 assert.match(route,/noPrinterConnected:true/);
 assert.doesNotMatch(route,/printer\.write|printBridge|sendToPrinter/);
});
