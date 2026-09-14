const http=require("http"), fs=require("fs"), path=require("path"), crypto=require("crypto");
const PORT=process.env.PORT||8080;
const BRIDGE_KEY=process.env.BRIDGE_KEY||"CAMBIA-QUESTA-CHIAVE";
const DATA=process.env.DATA_DIR||path.join(__dirname,"data");
const ORDERS=path.join(DATA,"orders.json");
const PUB=path.join(__dirname,"public");
fs.mkdirSync(DATA,{recursive:true}); if(!fs.existsSync(ORDERS)) fs.writeFileSync(ORDERS,"[]");

function readOrders(){try{return JSON.parse(fs.readFileSync(ORDERS,"utf8"))}catch{return[]}}
function writeOrders(x){fs.writeFileSync(ORDERS,JSON.stringify(x,null,2))}
function send(res,status,obj,headers={}){const body=typeof obj==="string"?obj:JSON.stringify(obj);res.writeHead(status,{"Content-Type":typeof obj==="string"?"text/plain; charset=utf-8":"application/json; charset=utf-8",...headers});res.end(body)}
function jsonBody(req){return new Promise((resolve,reject)=>{let b="";req.on("data",c=>{b+=c;if(b.length>1e6)req.destroy()});req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch(e){reject(e)}})})}
function nextId(orders){const d=new Date(), ymd=d.toISOString().slice(0,10).replaceAll("-","");const today=orders.filter(o=>o.created_at?.startsWith(d.toISOString().slice(0,10))).length+1;return `${ymd}-${String(today).padStart(3,"0")}`}
function isBridge(req){return req.headers["x-api-key"]===BRIDGE_KEY}
function validPickup(s){return /^([01]\d|2[0-3]):[0-5]\d$/.test(s||"")}

const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,`http://${req.headers.host}`);
 if(req.method==="POST"&&u.pathname==="/api/orders"){
   try{
    const b=await jsonBody(req);
    if(!b.customer_name||!b.phone||!validPickup(b.pickup_time)||!Array.isArray(b.items)||!b.items.length) return send(res,400,{error:"Dati ordine incompleti"});
    const orders=readOrders(), id=nextId(orders);
    const total=b.items.reduce((s,x)=>s+(Number(x.price)||0)*(Number(x.qty)||0),0);
    const now=new Date();
    const order={id,pickup_time:b.pickup_time,customer_name:String(b.customer_name).slice(0,80),phone:String(b.phone).slice(0,40),
      items:b.items.map(x=>({qty:Number(x.qty)||1,name:String(x.name||"").slice(0,80),ingredients:String(x.ingredients||"").slice(0,200),changes:String(x.changes||"").slice(0,200),price:Number(x.price)||0})),
      notes:String(b.notes||"").slice(0,300),total:Number(total.toFixed(2)),received_at:now.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"}),
      created_at:now.toISOString(),status:"pending",print_token:crypto.randomBytes(12).toString("hex")};
    orders.push(order);writeOrders(orders);return send(res,201,{ok:true,order});
   }catch(e){return send(res,400,{error:"JSON non valido"})}
 }
 if(req.method==="GET"&&u.pathname==="/api/bridge/orders"){
   if(!isBridge(req)) return send(res,401,{error:"Non autorizzato"});
   const orders=readOrders().filter(o=>o.status==="pending").slice(0,20);
   return send(res,200,{orders});
 }
 if(req.method==="POST"&&u.pathname.startsWith("/api/bridge/orders/")&&u.pathname.endsWith("/printed")){
   if(!isBridge(req)) return send(res,401,{error:"Non autorizzato"});
   const id=decodeURIComponent(u.pathname.split("/")[4]), orders=readOrders(), o=orders.find(x=>x.id===id);
   if(!o)return send(res,404,{error:"Ordine non trovato"});o.status="printed";o.printed_at=new Date().toISOString();writeOrders(orders);return send(res,200,{ok:true});
 }
 if(req.method==="GET"&&u.pathname==="/api/health")return send(res,200,{ok:true});
 let file=u.pathname==="/"?"index.html":u.pathname.replace(/^\/+/,"");
 const fp=path.join(PUB,file);
 if(!fp.startsWith(PUB)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory())return send(res,404,"Not found");
 const ext=path.extname(fp), ct={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"}[ext]||"application/octet-stream";
 res.writeHead(200,{"Content-Type":ct,"Cache-Control":"no-store"});fs.createReadStream(fp).pipe(res);
});
server.listen(PORT,()=>console.log(`Piadineria server attivo sulla porta ${PORT}`));
