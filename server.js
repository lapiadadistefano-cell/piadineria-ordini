const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const ORDERS_CLOSED=process.env.ORDERS_CLOSED==="true";
const adminControl=require("./lib/admin-control");
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||"";
let adminReady=false;
if(process.env.DATABASE_URL)adminControl.initializeAdmin().then(()=>{adminReady=true}).catch(e=>console.error("Admin initialization failed:",e.message));
function adminAuthorized(req){if(!ADMIN_PASSWORD)return false;const auth=req.headers.authorization||"";if(!auth.startsWith("Basic "))return false;let raw;try{raw=Buffer.from(auth.slice(6),"base64").toString("utf8")}catch{return false}const i=raw.indexOf(":");if(i<0||raw.slice(0,i)!=="admin")return false;const candidate=Buffer.from(raw.slice(i+1));const expected=Buffer.from(ADMIN_PASSWORD);return candidate.length===expected.length&&crypto.timingSafeEqual(candidate,expected)}
function adminChallenge(res){return send(res,401,{error:"Accesso amministratore richiesto"},{"WWW-Authenticate":'Basic realm="La Piada di Stefano - Amministrazione"',"Cache-Control":"no-store"})}
async function ordersClosed(){if(ORDERS_CLOSED)return true;if(!adminReady)return false;return adminControl.getOrdersClosed()}
const {validatePaymentNotification,parseNotification}=require("./lib/mypos-production-notify");
const {buildLiveCheckout}=require("./lib/mypos-live-checkout");
const {loadMyposConfigurationPackage}=require("./lib/mypos-config-package");
const MYPosPackage=process.env.MYPOS_CONFIGURATION_PACKAGE||"";
if(process.env.ORDERS_DB_TABLE==="v9_trial_pickup_orders"){
  try{loadMyposConfigurationPackage(MYPosPackage);console.log("V9 myPOS configuration package: valid structure and RSA keys")}
  catch(e){console.error("V9 myPOS configuration package validation failed:",e.message)}
}
const USE_DATABASE=Boolean(process.env.DATABASE_URL);
const productionDb=USE_DATABASE?require("./lib/production-orders-db"):null;
let dbReady=!USE_DATABASE;
if(USE_DATABASE)productionDb.init().then(()=>{dbReady=true;console.log("Production orders database ready")}).catch(e=>{console.error("Production orders database unavailable",e.message);process.exit(1)});
const PORT=process.env.PORT||8080,BRIDGE_KEY=process.env.BRIDGE_KEY||"CAMBIA-QUESTA-CHIAVE",DATA=process.env.DATA_DIR||path.join(__dirname,"data"),ORDERS=path.join(DATA,"orders.json"),PUB=path.join(__dirname,"public"),MENU=path.join(PUB,"menu.json");
fs.mkdirSync(DATA,{recursive:true});if(!fs.existsSync(ORDERS))fs.writeFileSync(ORDERS,"[]");
const readOrders=()=>{try{return JSON.parse(fs.readFileSync(ORDERS,"utf8"))}catch{return[]}},writeOrders=x=>fs.writeFileSync(ORDERS,JSON.stringify(x,null,2)),readMenu=()=>{try{return JSON.parse(fs.readFileSync(MENU,"utf8"))}catch{return[]}};
function send(res,status,obj,headers={}){const body=typeof obj==="string"?obj:JSON.stringify(obj);res.writeHead(status,{"Content-Type":typeof obj==="string"?"text/plain; charset=utf-8":"application/json; charset=utf-8","X-Content-Type-Options":"nosniff",...headers});res.end(body)}
function jsonBody(req){return new Promise((resolve,reject)=>{let b="",tooBig=false;req.on("data",c=>{b+=c;if(b.length>100000){tooBig=true;req.destroy()}});req.on("end",()=>{if(tooBig)return reject(Error("too_big"));try{resolve(JSON.parse(b||"{}"))}catch{reject(Error("json"))}});req.on("error",reject)})}
function romeParts(d=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));return{weekday:p.weekday,date:`${p.year}-${p.month}-${p.day}`,ymd:`${p.year}${p.month}${p.day}`,minutes:+p.hour*60+ +p.minute,time:`${p.hour}:${p.minute}`}}
function nextId(orders){const r=romeParts(),nums=orders.filter(o=>o.id?.startsWith(r.ymd+"-")).map(o=>Number(o.id.split("-")[1])||0);return`${r.ymd}-${String((nums.length?Math.max(...nums):0)+1).padStart(3,"0")}`}
const isBridge=req=>process.env.ORDERS_DB_TABLE!=="v9_trial_pickup_orders" && Boolean(process.env.BRIDGE_KEY) && req.headers["x-api-key"]===BRIDGE_KEY;
function pickupMinutes(s){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s||""))return null;const[h,m]=s.split(":").map(Number);return h*60+m}
function validatePickup(s){const r=romeParts(),pm=pickupMinutes(s);if(r.weekday==="Sun")return"La domenica siamo chiusi";if(pm===null)return"Orario di ritiro non valido";if(!((pm>=690&&pm<=860)||(pm>=1050&&pm<=1200))||pm%10!==0)return"Orario di ritiro non disponibile";if(pm>=690&&pm<=860&&r.minutes>840)return"Gli ordini per il pranzo chiudono alle 14:00";if(pm<r.minutes+20)return"Scegli un orario di ritiro con almeno 20 minuti di anticipo";return null}
function cleanText(v,max){return String(v||"").replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim().slice(0,max)}
function validPhone(v){const digits=String(v||"").replace(/\D/g,"");return digits.length>=6&&digits.length<=15}
function officialItems(items){if(!Array.isArray(items)||!items.length||items.length>30)throw Error("Ordine non valido");const menu=readMenu();return items.map(x=>{const q=Number(x.qty);if(!Number.isInteger(q)||q<1||q>20)throw Error("Quantità non valida");const name=cleanText(x.name,80),product=menu.find(m=>m.name===name);if(!product)throw Error(`Prodotto non valido: ${name||"senza nome"}`);return{qty:q,name:product.name,ingredients:product.ingredients,changes:cleanText(x.changes,200),price:Number(product.price)}})}
function fingerprint(b,items,rp){return crypto.createHash("sha256").update(JSON.stringify({d:rp.date,n:cleanText(b.customer_name,80).toLowerCase(),p:String(b.phone).replace(/\D/g,""),t:b.pickup_time,i:items.map(x=>[x.name,x.qty,x.changes])})).digest("hex")}
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,`http://${req.headers.host}`);
 if(u.pathname==="/admin.html"||u.pathname.startsWith("/api/admin/")){
   if(!adminAuthorized(req))return adminChallenge(res);
   if(u.pathname==="/api/admin/status"&&req.method==="GET"){if(!adminReady)return send(res,503,{error:"Gestione non disponibile"});try{return send(res,200,{closed:await ordersClosed()},{"Cache-Control":"no-store"})}catch{return send(res,503,{error:"Stato non disponibile"})}}
   if(u.pathname==="/api/admin/status"&&req.method==="POST"){
     if(req.headers["x-admin-action"]!=="change-status")return send(res,403,{error:"Richiesta non autorizzata"});
     const origin=req.headers.origin;const host=req.headers["x-forwarded-host"]||req.headers.host;
     let originHost;try{originHost=new URL(origin).host}catch{return send(res,403,{error:"Origine non valida"})}if(!origin||!host||originHost!==host)return send(res,403,{error:"Origine non autorizzata"});
     if(!adminReady)return send(res,503,{error:"Gestione non disponibile"});
     try{const b=await jsonBody(req);if(typeof b.closed!=="boolean")return send(res,400,{error:"Valore non valido"});await adminControl.setOrdersClosed(b.closed);return send(res,200,{closed:await ordersClosed()},{"Cache-Control":"no-store"})}catch{return send(res,503,{error:"Impossibile salvare lo stato"})}
   }
   if(u.pathname.startsWith("/api/admin/"))return send(res,404,{error:"Non trovato"});
 }

 if(await ordersClosed()&&req.method==="POST"&&u.pathname==="/api/orders")return send(res,503,{error:"Ordina e Ritira è temporaneamente chiuso per oggi. Riprova alla prossima apertura."});
 if(req.method==="POST"&&u.pathname==="/api/orders"){try{const b=await jsonBody(req),name=cleanText(b.customer_name,80),phone=cleanText(b.phone,40);if(name.length<2)return send(res,400,{error:"Inserisci un nome valido"});if(!validPhone(phone))return send(res,400,{error:"Inserisci un numero di telefono valido"});const pickupError=validatePickup(b.pickup_time);if(pickupError)return send(res,400,{error:pickupError});let items;try{items=officialItems(b.items)}catch(e){return send(res,400,{error:e.message})}const now=new Date(),rp=romeParts(now),fp=fingerprint(b,items,rp),total=items.reduce((s,x)=>s+x.price*x.qty,0),makeOrder=orders=>({id:nextId(orders),pickup_time:b.pickup_time,customer_name:name,phone,items,notes:cleanText(b.notes,300),total:Number(total.toFixed(2)),received_at:rp.time,local_date:rp.date,created_at:now.toISOString(),status:"pending",payment_method:"cash",payment_status:"unpaid",payment_verified:false,fingerprint:fp,print_token:crypto.randomBytes(12).toString("hex")});if(USE_DATABASE){if(!dbReady)return send(res,503,{error:"Archivio ordini non disponibile"});const result=await productionDb.createOrder(makeOrder,fp);return send(res,result.duplicate?200:201,{ok:true,duplicate:result.duplicate,order:result.order})}const orders=readOrders(),duplicate=orders.find(o=>o.fingerprint===fp&&Date.now()-new Date(o.created_at).getTime()<120000);if(duplicate)return send(res,200,{ok:true,duplicate:true,order:duplicate});const order=makeOrder(orders);orders.push(order);writeOrders(orders);return send(res,201,{ok:true,order})}catch(e){return send(res,400,{error:e.message==="too_big"?"Ordine troppo grande":"Richiesta non valida"})}}
 if((req.method==="GET"||req.method==="POST")&&(u.pathname==="/mypos/return"||u.pathname==="/mypos/cancel")){
   const cancelled=u.pathname==="/mypos/cancel";
   const heading=cancelled?"Pagamento annullato":"Rientro dal pagamento";
   const detail=cancelled?"Il pagamento non è stato completato. Nessuna comanda viene stampata.":"Il pagamento è in fase di verifica. La conferma definitiva avviene tramite myPOS: questa pagina non significa che l'ordine sia già pagato.";
   const html='<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+heading+' - La Piada di Stefano</title><style>body{font-family:Arial,sans-serif;background:#f7f3ea;color:#222;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px;box-sizing:border-box}main{max-width:560px;background:white;border-radius:18px;padding:30px;box-shadow:0 8px 25px #0001;text-align:center}h1{color:#176b36}p{line-height:1.5}</style></head><body><main><h1>'+heading+'</h1><p>'+detail+'</p><p>La Piada di Stefano</p></main></body></html>';
   res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
   return res.end(html);
 }
 if(req.method==="POST"&&u.pathname==="/api/mypos/create"){
   if(await ordersClosed())return send(res,503,{error:"Ordina e Ritira temporaneamente chiuso"});
   if(!USE_DATABASE||!dbReady||!MYPosPackage)return send(res,503,{error:"Pagamento online non disponibile"});
   try{
     loadMyposConfigurationPackage(MYPosPackage);
     const b=await jsonBody(req),name=cleanText(b.customer_name,80),phone=cleanText(b.phone,40);
     if(name.length<2||!validPhone(phone))return send(res,400,{error:"Nome o telefono non valido"});
     const pickupError=validatePickup(b.pickup_time);
     if(pickupError)return send(res,400,{error:pickupError});
     const items=officialItems(b.items),now=new Date(),rp=romeParts(now);
     const fp=crypto.createHash("sha256").update("mypos:"+fingerprint(b,items,rp)).digest("hex");
     const total=Number(items.reduce((sum,item)=>sum+item.price*item.qty,0).toFixed(2));
     const makeOrder=orders=>{
       const id=nextId(orders);
       return {id,pickup_time:b.pickup_time,customer_name:name,phone,items,
         notes:cleanText(b.notes,300),total,received_at:rp.time,local_date:rp.date,
         created_at:now.toISOString(),status:"awaiting_payment",payment_method:"mypos",
         payment_status:"awaiting",payment_verified:false,payment_reference:id,
         fingerprint:fp,print_token:crypto.randomBytes(12).toString("hex")};
     };
     const created=await productionDb.createOrder(makeOrder,fp);
     if(created.order.payment_method!=="mypos"||created.order.payment_status!=="awaiting")
       return send(res,409,{error:"Ordine già presente con diversa modalità di pagamento"});
     const checkout=buildLiveCheckout(created.order,process.env.MYPOS_PUBLIC_ORIGIN||"https://la-piada-di-stefano-ordini.onrender.com",MYPosPackage);
     return send(res,created.duplicate?200:201,{ok:true,duplicate:created.duplicate,
       order:{id:created.order.id,total:created.order.total,pickup_time:created.order.pickup_time},checkout},{"Cache-Control":"no-store"});
   }catch(e){
     console.error("myPOS checkout creation failed:",e.message);
     return send(res,400,{error:"Impossibile avviare il pagamento"});
   }
 }
 if(req.method==="POST"&&u.pathname==="/api/mypos/notify"){
   if(!USE_DATABASE||!dbReady||!MYPosPackage)return send(res,503,{error:"Payments unavailable"});
   let body="";
   try {
     await new Promise((resolve,reject)=>{
       req.on("data",chunk=>{body+=chunk;if(body.length>20000){reject(Error("Body too large"));req.destroy();}});
       req.on("end",resolve);req.on("error",reject);
     });
     const fields=parseNotification(body);
     const verified=validatePaymentNotification(fields,MYPosPackage);
     const result=await productionDb.settleVerifiedPayment(verified.reference,verified.transactionRef,verified.amountCents);
     return send(res,200,"OK");
   }catch(e){console.error("myPOS notification rejected:",e.message);return send(res,400,{error:"Invalid payment notification"});}
 }
 if(req.method==="GET"&&u.pathname==="/api/bridge/orders"){if(!isBridge(req))return send(res,401,{error:"Non autorizzato"});if(USE_DATABASE&&!dbReady)return send(res,503,{error:"Archivio ordini non disponibile"});const pending=USE_DATABASE?await productionDb.pendingOrders():readOrders();return send(res,200,{orders:pending.filter(o=>o.status==="pending"&&(o.payment_method==null||(o.payment_method==="cash"&&o.payment_verified!==true&&(!o.payment_status||o.payment_status==="unpaid"))||(o.payment_method==="mypos"&&o.payment_status==="paid"&&o.payment_verified===true))).slice(0,20)})}
 if(req.method==="POST"&&u.pathname.startsWith("/api/bridge/orders/")&&u.pathname.endsWith("/printed")){if(!isBridge(req))return send(res,401,{error:"Non autorizzato"});const id=decodeURIComponent(u.pathname.split("/")[4]);if(USE_DATABASE){if(!dbReady)return send(res,503,{error:"Archivio ordini non disponibile"});const result=await productionDb.markPrinted(id);return result.kind==="missing"?send(res,404,{error:"Ordine non trovato"}):result.kind==="blocked"?send(res,409,{error:"Ordine non autorizzato alla stampa"}):send(res,200,{ok:true,alreadyPrinted:result.kind==="already"})}const orders=readOrders(),o=orders.find(x=>x.id===id);if(!o)return send(res,404,{error:"Ordine non trovato"});if(o.status==="printed")return send(res,200,{ok:true,alreadyPrinted:true});if(o.status!=="pending"||!(o.payment_method==null||(o.payment_method==="cash"&&o.payment_verified!==true&&(!o.payment_status||o.payment_status==="unpaid"))||(o.payment_method==="mypos"&&o.payment_status==="paid"&&o.payment_verified===true)))return send(res,409,{error:"Ordine non autorizzato alla stampa"});o.status="printed";o.printed_at=new Date().toISOString();writeOrders(orders);return send(res,200,{ok:true})}
 if(await ordersClosed()&&req.method==="GET"&&(u.pathname==="/"||u.pathname==="/index.html"))return send(res,200,'<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ordina e Ritira - Chiuso per oggi</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f3ea;color:#222;font-family:Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box}.card{max-width:600px;background:white;border:1px solid #ddd;border-radius:20px;padding:32px;box-shadow:0 8px 28px #0001}h1{font-size:28px;margin-top:0}p{font-size:18px;line-height:1.5}.brand{font-weight:bold;color:#0d6b2d}</style></head><body><main class="card"><div class="brand">LA PIADA DI STEFANO</div><h1>Ordina e Ritira è chiuso per oggi</h1><p>Oggi il servizio di prenotazione online è temporaneamente sospeso.</p><p>Ti aspettiamo alla prossima apertura. Grazie per la comprensione!</p></main></body></html>',{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
 if(req.method==="GET"&&u.pathname==="/api/health")return send(res,dbReady?200:503,{ok:dbReady,time:romeParts().time,storage:USE_DATABASE?"postgres":"local"});let file=u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/,""),fp=path.resolve(PUB,file);if(!fp.startsWith(path.resolve(PUB)+path.sep)&&fp!==path.resolve(PUB,"index.html"))return send(res,404,"Not found");if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory())return send(res,404,"Not found");const ext=path.extname(fp),ct={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"}[ext]||"application/octet-stream";res.writeHead(200,{"Content-Type":ct,"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});fs.createReadStream(fp).pipe(res)});
server.listen(PORT,()=>console.log(`Piadineria server attivo sulla porta ${PORT}`));