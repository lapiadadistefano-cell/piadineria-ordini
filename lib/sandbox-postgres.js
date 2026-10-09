"use strict";
// Sandbox-only persistent storage. Requires DATABASE_URL and the pg package.
// This module is not used by the live ordering service.
const { Pool } = require("pg");
function createSandboxStore(connectionString) {
  if (!connectionString) throw Error("Sandbox DATABASE_URL missing");
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5000 });
  async function init() {
    await pool.query(`CREATE TABLE IF NOT EXISTS sandbox_orders (
      payment_reference TEXT PRIMARY KEY,
      order_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }
  async function insert(order) {
    if (!order?.payment_reference) throw Error("Missing payment reference");
    await pool.query(
      "INSERT INTO sandbox_orders(payment_reference,order_data) VALUES($1,$2::jsonb)",
      [order.payment_reference, JSON.stringify(order)]
    );
  }
  async function get(reference) {
    const result = await pool.query("SELECT order_data FROM sandbox_orders WHERE payment_reference=$1", [reference]);
    return result.rows[0]?.order_data || null;
  }
  // Serialize callbacks for the same payment. A duplicate must never requeue printing.
  async function updateVerified(reference, verifyAndUpdate) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT order_data FROM sandbox_orders WHERE payment_reference=$1 FOR UPDATE", [reference]);
      if (!result.rowCount) throw Error("Unknown order");
      const updated = verifyAndUpdate(result.rows[0].order_data);
      await client.query("UPDATE sandbox_orders SET order_data=$2::jsonb WHERE payment_reference=$1", [reference, JSON.stringify(updated)]);
      await client.query("COMMIT");
      return updated;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }
  }
  // Dedicated disposable test row; never use a customer's order for simulation.
  async function simulatePrintOnce(reference, simulate) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query("SELECT order_data FROM sandbox_orders WHERE payment_reference=$1 FOR UPDATE", [reference]);
      if (!found.rowCount) throw Error("Unknown simulation order");
      const outcome = simulate(found.rows[0].order_data);
      if (outcome.printed) {
        await client.query("UPDATE sandbox_orders SET order_data=$2::jsonb WHERE payment_reference=$1", [reference, JSON.stringify(outcome.order)]);
      }
      await client.query("COMMIT");
      return { printed: outcome.printed, status: outcome.order.status };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally { client.release(); }
  }
  async function counts() {
    const result = await pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE order_data->>'payment_status'='paid' AND order_data->>'payment_verified'='true')::int AS verified_paid FROM sandbox_orders");
    return result.rows[0];
  }
  async function close() { await pool.end(); }
  return { init, insert, get, updateVerified, simulatePrintOnce, counts, close };
}
module.exports = { createSandboxStore };
