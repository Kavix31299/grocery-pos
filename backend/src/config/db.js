const { Pool } = require('pg');

const sslEnabled = process.env.DB_SSL === 'true';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'grocery_pos',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  ssl: sslEnabled ? { rejectUnauthorized: false } : false
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
