const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const {isLegacyBridgePrintable,createAwaitingPayment,simulatePrintOnce}=require("./lib/payment-state");
const {buildSandboxCheckout}=require("./lib/mypos-checkout");
const {parseNotification,processPurchaseNotify}=require("./lib/mypos-notify");
const {createSandboxStore}=require("./lib/sandbox-postgres");
const {runPrintLifecycleSimulation}=require("./lib/print-lifecycle-simulation");
const {claim:claimPrintState,onRestart:restartPrintState}=require("./lib/print-recovery");
const {isAuthorizedLabRequest}=require("./lib/v9-lab-auth");
const {resolvePrintReview}=require("./lib/print-review");
const MYPOS_SANDBOX=process.env.MYPOS_SANDBOX_ENABLED==="true" && process.env.MYPOS_STAGING_ONLY==="true";
const STAGING_DISABLE_BRIDGE=process.env.MYPOS_STAGING_ONLY==="true";
const SANDBOX_DB_ENABLED=MYPOS_SANDBOX&&process.env.MYPOS_SANDBOX_DB_ENABLED==="true";
const sandboxStore=SANDBOX_DB_ENABLED?createSandboxStore(process.env.DATABASE_URL):null;
const MYPOSTEST_DIAG={received:0,accepted:0,rejected:0,lastOutcome:"none",lastReason:"none"};
function myposDiag(outcome,reason="none"){
  MYPOSTEST_DIAG.received++;
  if(outcome==="accepted")MYPOSTEST_DIAG.accepted++;else MYPOSTEST_DIAG.rejected++;
  MYPOSTEST_DIAG.lastOutcome=outcome;
  MYPOSTEST_DIAG.lastReason=reason;
}

const PORT=process.env.PORT||8080,BRIDGE_KEY=process.env.BRIDGE_KEY||"CAMBIA-QUESTA-CHIAVE",DATA=process.env.DATA_DIR||path.join(__dirname,"data"),ORDERS=path.join(DATA,"orders.json"),PUB=path.join(__dirname,"public"),MENU=path.join(PUB,"menu.json");
fs.mkdirSync(DATA,{recursive:true});if(!fs.existsSync(ORDERS))fs.writeFileSync(ORDERS,"[]");
const readOrders=()=>{try{return JSON.parse(fs.readFileSync(ORDERS,"utf8"))}catch{return[]}},writeOrders=x=>fs.writeFileSync(ORDERS,JSON.stringify(x,null,2)),readMenu=()=>{try{return JSON.parse(fs.readFileSync(MENU,"utf8"))}catch{return[]}};
function send(res,status,obj,headers={}){const body=typeof obj==="string"?obj:JSON.stringify(obj);res.writeHead(status,{"Content-Type":typeof obj==="string"?"text/plain; charset=utf-8":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff",...headers});res.end(body)}
function jsonBody(req){return new Promise((resolve,reject)=>{let b="",tooBig=false;req.on("data",c=>{b+=c;if(b.length>100000){tooBig=true;req.destroy()}});req.on("end",()=>{if(tooBig)return reject(Error("too_big"));try{resolve(JSON.parse(b||"{}"))}catch{reject(Error("json"))}});req.on("error",reject)})}
function romeParts(d=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return{weekday:p.weekday,date:`${p.year}-${p.month}-${p.day}`,ymd:`${p.year}${p.month}${p.day}`,minutes:+p.hour*60+ +p.minute,time:`${p.hour}:${p.minute}`}}
function nextId(orders){const r=romeParts(),nums=orders.filter(o=>o.id?.startsWith(r.ymd+"-")).map(o=>Number(o.id.split("-")[1])||0);return`${r.ymd}-${String((nums.length?Math.max(...nums):0)+1).padStart(3,"0")}`}
const isBridge=req=>!STAGING_DISABLE_BRIDGE&&req.headers["x-api-key"]===BRIDGE_KEY;
function pickupMinutes(s){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s||""))return null;const[h,m]=s.split(":").map(Number);return h*60+m}
function validatePickup(s){const r=romeParts(),pm=pickupMinutes(s);if(r.weekday==="Sun")return"La domenica siamo chiusi";if(pm===null)return"Orario di ritiro non valido";if(!((pm>=690&&pm<=840)||(pm>=1050&&pm<=1200))||pm%10!==0)return"Orario di ritiro non disponibile";if(pm<r.minutes+20)return"Scegli un orario di ritiro con almeno 20 minuti di anticipo";return null}
function cleanText(v,max){return String(v||"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function validPhone(v){const digits=String(v||"").replace(/\D/g,"");return digits.length>=6&&digits.length<=15}
function officialItems(items){if(!Array.isArray(items)||!items.length||items.length>30)throw Error("Ordine non valido");const menu=readMenu();return items.map(x=>{const q=Number(x.qty);if(!Number.isInteger(q)||q<1||q>20)throw Error("Quantità non valida");const name=cleanText(x.name,80),product=menu.find(m=>m.name===name);if(!product)throw Error(`Prodotto non valido: ${name||"senza nome"}`);return{qty:q,name:product.name,ingredients:product.ingredients,changes:cleanText(x.changes,200),price:Number(product.price)}})}
function fingerprint(b,items,rp){return crypto.createHash("sha256").update(JSON.stringify({d:rp.date,n:cleanText(b.customer_name,80).toLowerCase(),p:String(b.phone).replace(/\D/g,""),t:b.pickup_time,i:items.map(x=>[x.name,x.qty,x.changes])})).digest("hex")}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);
 if(req.method==="POST"&&u.pathname==="/api/orders"){if(STAGING_DISABLE_BRIDGE)return send(res,403,{error:"Sito di prova: gli ordini reali sono disabilitati"});try{const b=await jsonBody(req),name=cleanText(b.customer_name,80),phone=cleanText(b.phone,40);if(name.length<2)return send(res,400,{error:"Inserisci un nome valido"});if(!validPhone(phone))return send(res,400,{error:"Inserisci un numero di telefono valido"});const pickupError=validatePickup(b.pickup_time);if(pickupError)return send(res,400,{error:pickupError});let items;try{items=officialItems(b.items)}catch(e){return send(res,400,{error:e.message})}const orders=readOrders(),now=new Date(),rp=romeParts(now),fp=fingerprint(b,items,rp),duplicate=orders.find(o=>o.fingerprint===fp&&Date.now()-new Date(o.created_at).getTime()<120000);if(duplicate)return send(res,200,{ok:true,duplicate:true,order:duplicate});const id=nextId(orders),total=items.reduce((s,x)=>s+x.price*x.qty,0),order={id,pickup_time:b.pickup_time,customer_name:name,phone,items,notes:cleanText(b.notes,300),total:Number(total.toFixed(2)),received_at:rp.time,local_date:rp.date,created_at:now.toISOString(),status:"pending",fingerprint:fp,print_token:crypto.randomBytes(12).toString("hex")};orders.push(order);writeOrders(orders);return send(res,201,{ok:true,order})}catch(e){return send(res,400,{error:e.message==="too_big"?"Ordine troppo grande":"Richiesta non valida"})}}
 if(req.method==="POST"&&u.pathname==="/api/v9-lab/create-review-fixture"){
   if(!MYPOS_SANDBOX||!sandboxStore)return send(res,404,{error:"Not available"});
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   try{
     const b=await jsonBody(req);
     if(b.reference!=="LAB-001")return send(res,400,{error:"Only LAB-001 is permitted"});
     const result=await sandboxStore.createLabReview("LAB-001");
     return send(res,result.created?201:409,{labOnly:true,noPrinterConnected:true,...result});
   }catch(e){
     if(e.message==="too_big"||e.message==="json")return send(res,400,{error:"Invalid JSON"});
     console.error("V9 fixture failed:",e.message);
     return send(res,503,{error:"Lab fixture unavailable"});
   }
 }
 if(req.method==="POST"&&u.pathname==="/api/v9-lab/resolve-review"){
   if(!MYPOS_SANDBOX||!sandboxStore)return send(res,404,{error:"Not available"});
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   try{
     const body=await jsonBody(req);
     if(typeof body.reference!=="string"||!/^LAB-[A-Za-z0-9-]{1,80}$/.test(body.reference)||
       !["confirm_printed","retry_after_check"].includes(body.action)||
       typeof body.reviewer!=="string"||!/^[A-Za-zÀ-ÿ0-9 .'-]{2,60}$/.test(body.reviewer.trim()))
       return send(res,400,{error:"Invalid review request"});
     const outcome=await sandboxStore.resolvePrintReview(body.reference,body.action,body.reviewer.trim(),resolvePrintReview);
     return send(res,200,{labOnly:true,noPrinterConnected:true,...outcome});
   }catch(e){
     if(e.message==="too_big"||e.message==="json")return send(res,400,{error:"Invalid JSON"});
     if(e.message==="Unknown lab order"||e.message==="Lab order not eligible for review"||e.message==="Lab reference required")
       return send(res,409,{error:"Lab order unavailable for review"});
     console.error("V9 sandbox review failed:",e.message);
     return send(res,503,{error:"Review unavailable"});
   }
 }
 if(req.method==="GET"&&u.pathname==="/api/v9-lab/fixture-order"){
   if(!MYPOS_SANDBOX||!sandboxStore)return send(res,404,{error:"Not available"});
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   try{
     // Fixed synthetic fixture only: no customer records or arbitrary references.
     const order=await sandboxStore.get("LAB-001");
     if(!order||order.payment_reference!=="LAB-001"||order.lab_only!==true||
        order.simulated_payment!==true||order.no_real_transaction!==true)
       return send(res,404,{error:"Lab fixture unavailable"});
     return send(res,200,{labOnly:true,readOnly:true,printerConnected:false,
       order:{payment_reference:"LAB-001",lab_only:true,simulated_payment:true,
         no_real_transaction:true,payment_verified:order.payment_verified===true,
         payment_status:order.payment_status,status:order.status,
         customer_name:"Cliente fittizio",
         items:[{name:"Piadina di prova",qty:1,price:8}]}});
   }catch(e){console.error("V9 lab fixture read unavailable:",e.message);
     return send(res,503,{error:"Unavailable"});}
 }
 if(req.method==="GET"&&u.pathname==="/api/v9-lab/status"){
   if(!MYPOS_SANDBOX||!sandboxStore)return send(res,404,{error:"Not available"});
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   try{
     const counts=await sandboxStore.counts();
     return send(res,200,{labOnly:true,readOnly:true,printerConnected:false,
       totalSandboxRows:counts.total,verifiedPaidSandboxRows:counts.verified_paid});
   }catch(e){console.error("V9 lab status unavailable:",e.message);return send(res,503,{error:"Unavailable"});}
 }
 if(req.method==="GET"&&u.pathname==="/api/mypos/config"){
   let keysReady=false;
   if(STAGING_DISABLE_BRIDGE){
     try{
       const privateKey=crypto.createPrivateKey((process.env.MYPOS_SANDBOX_PRIVATE_KEY||"").replace(/\\n/g,"\n"));
       const publicKey=crypto.createPublicKey((process.env.MYPOS_SANDBOX_API_PUBLIC_KEY||"").replace(/\\n/g,"\n"));
       keysReady=privateKey.asymmetricKeyType==="rsa"&&publicKey.asymmetricKeyType==="rsa";
     }catch{keysReady=false}
   }
   return send(res,200,{sandboxEnabled:MYPOS_SANDBOX,staging:STAGING_DISABLE_BRIDGE,keysReady});
 }
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/create"){try{
   const b=await jsonBody(req),name=cleanText(b.customer_name,80),phone=cleanText(b.phone,40);
   if(name.length<2||!validPhone(phone))return send(res,400,{error:"Dati cliente non validi"});
   const pickupError=validatePickup(b.pickup_time);if(pickupError)return send(res,400,{error:pickupError});
   const items=officialItems(b.items),orders=readOrders(),now=new Date(),rp=romeParts(now);
   const total=Number(items.reduce((sum,item)=>sum+item.price*item.qty,0).toFixed(2));
   const id=nextId(orders),reference="SBX-"+id+"-"+crypto.randomBytes(6).toString("hex");
   const order=createAwaitingPayment({id,pickup_time:b.pickup_time,customer_name:name,phone,items,
     notes:cleanText(b.notes,300),total,received_at:rp.time,local_date:rp.date,
     created_at:now.toISOString(),print_token:crypto.randomBytes(12).toString("hex"),status:"pending"},reference);
   const checkout=buildSandboxCheckout({order,baseUrl:process.env.MYPOS_PUBLIC_BASE_URL,
     privateKey:(process.env.MYPOS_SANDBOX_PRIVATE_KEY||"").replace(/\\n/g,"\n")});
   if(sandboxStore)await sandboxStore.insert(order);
   else {orders.push(order);writeOrders(orders)}
   return send(res,201,{ok:true,order:{id,total,pickup_time:order.pickup_time},checkout});
 }catch(e){console.error("myPOS sandbox create failed:",e.message);return send(res,400,{error:"Impossibile preparare il pagamento di prova"})}}
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/recovery-check"){
  if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
  if(!sandboxStore)return send(res,503,{error:"Sandbox database unavailable"});
  try{
    const id="SIM-REC-"+crypto.randomBytes(12).toString("hex");
    await sandboxStore.insert({id,payment_reference:id,status:"pending",payment_method:"mypos",payment_status:"paid",payment_verified:true});
    const first=await sandboxStore.claimPrint(id,"sim-worker",claimPrintState);
    const recovery=await sandboxStore.recoverPrint(id,restartPrintState);
    const saved=await sandboxStore.get(id);
    const repeat=await sandboxStore.claimPrint(id,"sim-worker-2",claimPrintState);
    return send(res,200,{simulationOnly:true,claimed:first.claimed,needsReview:recovery.needsReview,savedStatus:saved.status,retryBlocked:!repeat.claimed,noPrinterConnected:true});
  }catch(e){console.error("Recovery check:",e.message);return send(res,503,{error:"Recovery check failed"});}
 }
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/claim-simulation"){
  if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   if(!sandboxStore)return send(res,503,{error:"Database not enabled"});
   try {
     const reference="SIM-CLAIM-"+crypto.randomBytes(12).toString("hex");
     await sandboxStore.insert({id:reference,payment_reference:reference,status:"pending",
       payment_method:"mypos",payment_status:"paid",payment_verified:true,total:7,
       created_at:new Date().toISOString()});
     const attempts=await Promise.all([
       sandboxStore.claimPrint(reference,"worker-A",claimPrintState),
       sandboxStore.claimPrint(reference,"worker-B",claimPrintState)
     ]);
     const saved=await sandboxStore.get(reference);
     return send(res,200,{simulationOnly:true,attempts:attempts.length,
       accepted:attempts.filter(x=>x.claimed).length,rejected:attempts.filter(x=>!x.claimed).length,
       savedStatus:saved?.status,noPrinterConnected:true});
   }catch(e){console.error("Sandbox claim simulation failed:",e.message);return send(res,503,{error:"Simulation failed"})}
 }
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/lifecycle-simulation"){
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   try{return send(res,200,runPrintLifecycleSimulation())}
   catch(e){console.error("Lifecycle simulation failed:",e.message);return send(res,503,{error:"Simulation failed"})}
 }
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/print-simulation"){
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   if(!sandboxStore)return send(res,503,{error:"Database not enabled"});
   try {
     const reference="SIM-PRINT-"+crypto.randomBytes(12).toString("hex");
     const order={id:reference,status:"pending",payment_method:"mypos",payment_status:"paid",
       payment_verified:true,payment_reference:reference,total:7,created_at:new Date().toISOString()};
     await sandboxStore.insert(order);
     // Concurrent requests exercise PostgreSQL row locking, not just sequential calls.
     const attempts=await Promise.all([
       sandboxStore.simulatePrintOnce(reference,simulatePrintOnce),
       sandboxStore.simulatePrintOnce(reference,simulatePrintOnce)
     ]);
     const accepted=attempts.filter(x=>x.printed).length;
     const rejected=attempts.filter(x=>!x.printed).length;
     const finalOrder=await sandboxStore.get(reference);
     return send(res,200,{simulationOnly:true,concurrent:true,accepted,rejected,
       finalStatus:finalOrder?.status,noPrinterConnected:true});
   }catch(e){console.error("Sandbox print simulation failed:",e.message);return send(res,503,{error:"Simulation failed"})}
 }
 if(MYPOS_SANDBOX&&req.method==="GET"&&u.pathname==="/api/mypos/persistence-check"){
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   if(!sandboxStore)return send(res,503,{databaseEnabled:false});
   try { const counts=await sandboxStore.counts();return send(res,200,{databaseEnabled:true,ordersStored:counts.total,verifiedPaidStored:counts.verified_paid,note:"Aggregate sandbox counts only; no customer data"}); }
   catch(e){console.error("Sandbox persistence check failed:",e.message);return send(res,503,{error:"Database unavailable"})}
 }
 if(MYPOS_SANDBOX&&req.method==="GET"&&u.pathname==="/api/mypos/diagnostics"){
   if(!isAuthorizedLabRequest(req,process.env))return send(res,403,{error:"Forbidden"});
   return send(res,200,{staging:STAGING_DISABLE_BRIDGE,sandboxEnabled:MYPOS_SANDBOX,databaseEnabled:!!sandboxStore,notifications:{...MYPOSTEST_DIAG},note:"Counts since last server start only; no order or payment details exposed"});
 }
 if(MYPOS_SANDBOX&&req.method==="POST"&&u.pathname==="/api/mypos/notify"){try{
   if(!String(req.headers["content-type"]||"").toLowerCase().startsWith("application/x-www-form-urlencoded"))return send(res,415,"Unsupported");
   let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send(res,413,"Too large")}
   const fields=parseNotification(raw);
   const verify=order=>processPurchaseNotify(order,fields,(process.env.MYPOS_SANDBOX_API_PUBLIC_KEY||"").replace(/\\n/g,"\n"),process.env.MYPOS_SANDBOX_STORE_ID||"000000000000010");
   if(sandboxStore)await sandboxStore.updateVerified(fields.OrderID,verify);
   else {
     const orders=readOrders(),order=orders.find(o=>o.payment_reference===fields.OrderID);
     if(!order)return send(res,404,"Unknown order");
     const updated=verify(order);orders[orders.indexOf(order)]=updated;writeOrders(orders);
   }
   myposDiag("accepted");
   return send(res,200,"OK");
 }catch(e){myposDiag("rejected",e.message==="Invalid signature"?"signature":e.message==="Unknown order"?"unknown_order":"validation");console.error("myPOS sandbox notify rejected:",e.message);return send(res,400,"FAIL")}}
 if(MYPOS_SANDBOX&&(req.method==="GET"||req.method==="POST")&&(u.pathname==="/mypos/return"||u.pathname==="/mypos/cancel"))
   return send(res,200,u.pathname==="/mypos/return"?"Pagamento in verifica: attendi la conferma dell'ordine.":"Pagamento annullato. Nessun ordine inviato.");
 if(req.method==="GET"&&u.pathname==="/api/bridge/orders"){if(!isBridge(req))return send(res,401,{error:"Non autorizzato"});return send(res,200,{orders:readOrders().filter(isLegacyBridgePrintable).slice(0,20)})}
 if(req.method==="POST"&&u.pathname.startsWith("/api/bridge/orders/")&&u.pathname.endsWith("/printed")){if(!isBridge(req))return send(res,401,{error:"Non autorizzato"});const id=decodeURIComponent(u.pathname.split("/")[4]),orders=readOrders(),o=orders.find(x=>x.id===id);if(!o)return send(res,404,{error:"Ordine non trovato"});if(!isLegacyBridgePrintable(o))return send(res,409,{error:"Ordine non autorizzato alla stampa"});o.status="printed";o.printed_at=new Date().toISOString();writeOrders(orders);return send(res,200,{ok:true})}
 if(req.method==="GET"&&u.pathname==="/api/health")return send(res,200,{ok:true,time:romeParts().time});let file=u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/,""),fp=path.resolve(PUB,file);if(!fp.startsWith(path.resolve(PUB)+path.sep)&&fp!==path.resolve(PUB,"index.html"))return send(res,404,"Not found");if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory())return send(res,404,"Not found");const ext=path.extname(fp),ct={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"}[ext]||"application/octet-stream";res.writeHead(200,{"Content-Type":ct,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});fs.createReadStream(fp).pipe(res)});
(async()=>{if(sandboxStore)await sandboxStore.init();server.listen(PORT,()=>console.log(`Piadineria server attivo sulla porta ${PORT}`))})().catch(e=>{console.error("Sandbox database initialization failed:",e.message);process.exitCode=1});