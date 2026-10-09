"use strict";
const crypto=require("node:crypto");
// Dedicated read-only V9 sandbox gate. Never accepts the existing V8 bridge key.
function isAuthorizedLabRequest(req,env){
 if(env.MYPOS_STAGING_ONLY!=="true"||env.MYPOS_SANDBOX_ENABLED!=="true")return false;
 const expected=env.V9_LAB_READ_KEY;
 const supplied=req.headers?.["x-v9-lab-key"];
 if(typeof expected!=="string"||expected.length<32||typeof supplied!=="string")return false;
 const a=Buffer.from(expected,"utf8"),b=Buffer.from(supplied,"utf8");
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
module.exports={isAuthorizedLabRequest};
