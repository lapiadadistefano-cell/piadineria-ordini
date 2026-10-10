const { Pool } = require('pg');

const SETTINGS_TABLE = process.env.ORDERS_DB_TABLE === 'v9_trial_pickup_orders' ? 'admin_settings' : 'production_admin_settings';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 5000 });

async function initializeAdmin() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO ${SETTINGS_TABLE} (key, value)
    VALUES ('orders_closed', 'false')
    ON CONFLICT (key) DO NOTHING
  `);
}

async function getOrdersClosed() {
  const result = await pool.query(
    `SELECT value FROM ${SETTINGS_TABLE} WHERE key = $1`,
    ['orders_closed']
  );
  if (!result.rows.length) throw new Error('Impostazione ordini non inizializzata');
  return result.rows[0].value === 'true';
}

async function setOrdersClosed(closed) {
  if (typeof closed !== 'boolean') throw new TypeError('Valore non valido');
  await pool.query(
    `UPDATE ${SETTINGS_TABLE} SET value = $1 WHERE key = $2`,
    [String(closed), 'orders_closed']
  );
}

module.exports = { initializeAdmin, getOrdersClosed, setOrdersClosed };
