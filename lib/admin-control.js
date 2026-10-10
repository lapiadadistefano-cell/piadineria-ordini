const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

async function initializeAdmin() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO admin_settings (key, value)
    VALUES ('orders_closed', 'false')
    ON CONFLICT (key) DO NOTHING
  `);
}

async function getOrdersClosed() {
  const result = await pool.query(
    'SELECT value FROM admin_settings WHERE key = $1',
    ['orders_closed']
  );
  if (!result.rows.length) throw new Error('Impostazione ordini non inizializzata');
  return result.rows[0].value === 'true';
}

async function setOrdersClosed(closed) {
  if (typeof closed !== 'boolean') throw new TypeError('Valore non valido');
  await pool.query(
    'UPDATE admin_settings SET value = $1 WHERE key = $2',
    [String(closed), 'orders_closed']
  );
}

module.exports = { initializeAdmin, getOrdersClosed, setOrdersClosed };
