"use strict";
const { Pool } = require("pg");
// Production orders live in a separate table; LAB sandbox tables are never queried.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS production_pickup_orders (
    id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS production_pickup_orders_status_idx ON production_pickup_orders(status, created_at)");
}
async function createOrder(makeOrder, fingerprint) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(948271)");
    const recent = await client.query("SELECT payload FROM production_pickup_orders WHERE fingerprint=$1 AND created_at > NOW() - INTERVAL '2 minutes' ORDER BY created_at DESC LIMIT 1", [fingerprint]);
    if (recent.rows.length) { await client.query("COMMIT"); return { order: recent.rows[0].payload, duplicate: true }; }
    const allToday = await client.query("SELECT id FROM production_pickup_orders WHERE id LIKE $1", [new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Rome"}).replace(/-/g,"")+"-%"]);
    const order = makeOrder(allToday.rows);
    await client.query("INSERT INTO production_pickup_orders(id,fingerprint,created_at,status,payload) VALUES($1,$2,$3,$4,$5::jsonb)", [order.id, order.fingerprint, order.created_at, order.status, JSON.stringify(order)]);
    await client.query("COMMIT");
    return { order, duplicate: false };
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}
async function pendingOrders() {
  const {rows} = await pool.query("SELECT payload FROM production_pickup_orders WHERE status='pending' ORDER BY created_at LIMIT 100");
  return rows.map(r=>r.payload);
}
async function markPrinted(id) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {rows} = await client.query("SELECT payload FROM production_pickup_orders WHERE id=$1 FOR UPDATE", [id]);
    if(!rows.length) { await client.query("COMMIT"); return {kind:"missing"}; }
    const o=rows[0].payload;
    if(o.status==="printed") { await client.query("COMMIT"); return {kind:"already"}; }
    const allowed=o.status==="pending"&&(o.payment_method==null||(o.payment_method==="cash"&&o.payment_verified!==true&&(!o.payment_status||o.payment_status==="unpaid"))||(o.payment_method==="mypos"&&o.payment_status==="paid"&&o.payment_verified===true));
    if(!allowed) { await client.query("COMMIT"); return {kind:"blocked"}; }
    o.status="printed";o.printed_at=new Date().toISOString();
    await client.query("UPDATE production_pickup_orders SET status='printed',payload=$2::jsonb WHERE id=$1",[id,JSON.stringify(o)]);
    await client.query("COMMIT");return {kind:"ok"};
  } catch(e) { await client.query("ROLLBACK");throw e; }
  finally { client.release(); }
}

async function saveAwaitingPayment(order) {
  if (order.status !== "awaiting_payment" || order.payment_method !== "mypos" || order.payment_verified !== false) throw Error("Invalid payment state");
  await pool.query("INSERT INTO production_pickup_orders(id,fingerprint,created_at,status,payload) VALUES($1,$2,$3,$4,$5::jsonb)",[order.id,order.fingerprint,order.created_at,order.status,JSON.stringify(order)]);
}

async function settleVerifiedPayment(reference, transactionRef, amountCents) {
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const found=await client.query("SELECT payload FROM production_pickup_orders WHERE id=$1 FOR UPDATE",[reference]);
    if(!found.rows.length)throw Error("Order not found");
    const order=found.rows[0].payload;
    if(order.payment_method!=="mypos" || order.payment_reference!==reference)throw Error("Wrong payment reference");
    if(order.payment_status==="paid" && order.payment_verified===true) {
      if(order.payment_transaction_ref!==transactionRef)throw Error("Conflicting payment");
      await client.query("COMMIT");
      return {duplicate:true};
    }
    if(order.status!=="awaiting_payment" || order.payment_status!=="awaiting" || order.payment_verified!==false)throw Error("Not awaiting payment");
    if(Math.round(order.total*100)!==amountCents || !transactionRef)throw Error("Payment amount mismatch");
    order.status="pending";
    order.payment_status="paid";
    order.payment_verified=true;
    order.payment_transaction_ref=transactionRef;
    order.payment_confirmed_at=new Date().toISOString();
    await client.query("UPDATE production_pickup_orders SET status='pending',payload=$2::jsonb WHERE id=$1",[reference,JSON.stringify(order)]);
    await client.query("COMMIT");
    return {duplicate:false};
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
module.exports={init,createOrder,saveAwaitingPayment,settleVerifiedPayment,pendingOrders,markPrinted};
