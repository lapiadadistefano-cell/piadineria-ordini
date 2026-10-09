"use strict";
// Explicit operator resolution of ambiguous physical print outcomes.
// No automatic retries and no printer/network I/O.
function resolvePrintReview(order,action,reviewer,now="2026-10-09T09:15:00.000Z"){
 if(order?.status!=="print_review_required")throw Error("Order not awaiting print review");
 if(!["confirm_printed","retry_after_check"].includes(action))throw Error("Invalid review action");
 if(typeof reviewer!=="string"||!reviewer.trim())throw Error("Reviewer required");
 const audit={action,reviewer:reviewer.trim(),at:now,previous_status:order.status};
 if(action==="confirm_printed")return {...order,status:"printed",printed_at:now,print_review:audit};
 // Manual verification that no paper command was produced is mandatory before retry.
 // A new claim token must be acquired by the print worker before printing.
 return {...order,status:"pending",print_claim:null,print_claimed_at:null,print_review:audit};
}
module.exports={resolvePrintReview};
