'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const keys = crypto.generateKeyPairSync('rsa', {modulusLength:2048});
const pack = Buffer.from(JSON.stringify({sid:'1495244',cn:'40006270082',idx:1,
 pk:keys.privateKey.export({type:'pkcs8',format:'pem'}),pc:keys.publicKey.export({type:'spki',format:'pem'})})).toString('base64');
class FixedDate extends Date { constructor(...args) {super(...(args.length?args:['2026-10-12T10:00:00Z']));} }
async function fixture(t) {
 const disabled=new Set(), orders=[];let failed=false, race=false, listener;
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'menu-test-'));
 const admin={initializeAdmin:async()=>{},getOrdersClosed:async()=>false,
  getMenuAvailability:async()=>{if(failed)throw Error('offline');return new Set(disabled)},
  setMenuAvailability:async(name,available)=>{if(failed)throw Error('offline');available?disabled.delete(name):disabled.add(name)}};
 const db={init:async()=>{},createOrder:async(make,fp,validate)=>{
  if(race)disabled.add('ROMAGNOLA');await validate({});
  const order=make(orders);orders.push(order);return {order,duplicate:false};
 },pendingOrders:async()=>orders};
 const context={require:name=>name==='./lib/admin-control'?admin:name==='./lib/production-orders-db'?db:
  name==='http'?{createServer:handler=>{listener=http.createServer(handler);return {listen:()=>listener.listen(0,'127.0.0.1')};}}:
  name.startsWith('./')?require(path.join(root,name)):require(name),
  process:{env:{DATABASE_URL:'mock',ADMIN_PASSWORD:'test-password',DATA_DIR:temp,BRIDGE_KEY:'test-bridge',MYPOS_CONFIGURATION_PACKAGE:pack}},
  __dirname:root,Buffer,URL,Date:FixedDate,console:{log(){},error(){}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'server.js'),'utf8'),context);
 await new Promise(resolve=>listener.listening?resolve():listener.once('listening',resolve));
 await new Promise(resolve=>setImmediate(resolve));
 t.after(async()=>{await new Promise(resolve=>listener.close(resolve));fs.rmSync(temp,{recursive:true,force:true});});
 const origin=`http://127.0.0.1:${listener.address().port}`;
 async function request(route,body,adminAuth=false,extra={}) {
  const headers={...extra};if(body)headers['Content-Type']='application/json';
  if(adminAuth)headers.Authorization='Basic '+Buffer.from('admin:test-password').toString('base64');
  const response=await fetch(origin+route,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json(),headers:response.headers};
 }
 const change=(available,extra={})=>request('/api/admin/menu',{name:'ROMAGNOLA',available},true,{'X-Admin-Action':'change-availability',Origin:origin,...extra});
 const order={customer_name:'Test',phone:'3331234567',pickup_time:'12:30',items:[{name:'ROMAGNOLA',qty:1}]};
 return {request,change,order,orders,disabled,setFailed:v=>failed=v,setRace:v=>race=v,origin};
}
test('admin availability requires authentication, action header and same origin',async t=>{
 const f=await fixture(t);
 assert.equal((await f.request('/api/admin/menu')).status,401);
 assert.equal((await f.request('/api/admin/menu',{name:'ROMAGNOLA',available:false})).status,401);
 assert.equal((await f.change(false,{Origin:'https://attacker.example'})).status,403);
 assert.equal((await f.change(false,{'X-Admin-Action':''})).status,403);
 assert.equal((await f.request('/api/admin/menu',{name:'NO SUCH ITEM',available:false},true,{'X-Admin-Action':'change-availability',Origin:f.origin})).status,400);
 assert.equal((await f.change('false')).status,400);
 assert.equal(f.disabled.size,0);
});
test('disable hides article, blocks stale carts for cash and myPOS; re-enable restores it',async t=>{
 const f=await fixture(t);
 assert.equal((await f.change(false)).status,200);
 for(const route of ['/api/menu','/menu.json']){
  const result=await f.request(route);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal(result.body.some(x=>x.name==='ROMAGNOLA'),false);
 }
 const admin=await f.request('/api/admin/menu',undefined,true);
 assert.equal(admin.body.find(x=>x.name==='ROMAGNOLA').available,false);
 for(const route of ['/api/orders','/api/mypos/create']){
  const result=await f.request(route,f.order);assert.equal(result.status,409);assert.match(result.body.error,/ROMAGNOLA/);
 }
 assert.equal(f.orders.length,0);
 assert.equal((await f.change(true)).status,200);
 assert.equal((await f.request('/api/orders',f.order)).status,201);
 assert.equal(f.orders[0].total,7);
});
test('existing orders remain unchanged and printable after an article is disabled',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/api/orders',f.order)).status,201);
 const saved=JSON.stringify(f.orders[0]);await f.change(false);
 assert.equal(JSON.stringify(f.orders[0]),saved);
 const pending=await f.request('/api/bridge/orders',undefined,false,{'X-Api-Key':'test-bridge'});
 assert.equal(pending.status,200);assert.equal(pending.body.orders.length,1);assert.equal(pending.body.orders[0].items[0].name,'ROMAGNOLA');
});
test('database availability failure prevents new orders and never presents an all-available menu',async t=>{
 const f=await fixture(t);f.setFailed(true);
 for(const route of ['/api/menu','/api/admin/menu'])assert.equal((await f.request(route,undefined,true)).status,503);
 for(const route of ['/api/orders','/api/mypos/create'])assert.equal((await f.request(route,f.order)).status,503);
 assert.equal((await f.change(false)).status,503);assert.equal(f.orders.length,0);
});
test('availability is checked again inside order acceptance, for both payment methods',async t=>{
 const f=await fixture(t);f.setRace(true);
 for(const route of ['/api/orders','/api/mypos/create']){
  f.disabled.clear();assert.equal((await f.request(route,f.order)).status,409);
 }
 assert.equal(f.orders.length,0);
});
function loadDbModule(file,table,client){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{module,exports:module.exports,process:{env:{DATABASE_URL:'mock',ORDERS_DB_TABLE:table}},require:name=>{
  assert.equal(name,'pg');return {Pool:class{async connect(){return client}query(...args){return client.query(...args)}}};
 },Date});return module.exports;
}
test('disabled states survive initialization and production and trial use separate tables',async()=>{
 for(const [table,expected] of [['v9_trial_pickup_orders','admin_settings'],['','production_admin_settings']]){
  const queries=[],rows=new Map();
  const client={release(){},async query(sql,params){queries.push(sql);
   if(params?.[0]?.startsWith('menu:'))rows.set(params[0],params[1]);
   if(sql.includes("LIKE 'menu:%'"))return {rows:[...rows].map(([key,value])=>({key,value}))};
   return {rows:[]};}};
  const admin=loadDbModule('lib/admin-control.js',table,client);
  await admin.initializeAdmin();await admin.setMenuAvailability('ROMAGNOLA',false);await admin.initializeAdmin();
  assert.equal((await admin.getMenuAvailability()).has('ROMAGNOLA'),true);
  await admin.setMenuAvailability('ROMAGNOLA',true);assert.equal((await admin.getMenuAvailability()).has('ROMAGNOLA'),false);
  assert.ok(queries.some(sql=>sql.includes(expected)));
  assert.ok(queries.some(sql=>sql.includes('pg_advisory_xact_lock(948271)')));
 }
});
test('order transaction holds the shared lock during validation and rolls back if unavailable',async()=>{
 const calls=[];let released=false;
 const client={async query(sql){calls.push(sql);return {rows:[]}},release(){released=true}};
 const db=loadDbModule('lib/production-orders-db.js','',client);
 await assert.rejects(db.createOrder(()=>assert.fail('must not create an order'),'fp',async transaction=>{
  assert.equal(transaction,client);assert.ok(calls.at(-1).includes('pg_advisory_xact_lock(948271)'));throw Error('esaurito');
 }),/esaurito/);
 assert.equal(calls.at(-1),'ROLLBACK');assert.ok(released);
 assert.equal(calls.some(sql=>sql.startsWith('INSERT')),false);
});
