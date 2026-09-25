const { isProduction } = require('./env');
const { Client, Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');

const databaseUrl = process.env.DATABASE_URL?.trim();

if (isProduction && !databaseUrl) {
  throw new Error('DATABASE_URL is required in production/Vercel/Render. Set the provider connection URL in the backend runtime environment, then redeploy.');
}

if (databaseUrl) {
  let parameters;

  try {
    const url = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
        || !url.hostname || !url.pathname || url.pathname === '/') {
      throw new Error('Incomplete PostgreSQL URL');
    }

    // Parse with the installed driver, including query-string host overrides
    // and TLS options, without opening a database connection.
    parameters = new Client({ connectionString: databaseUrl }).connectionParameters;
  } catch {
    // Parser errors can contain credentials. Never include the URL or cause.
    throw new Error('DATABASE_URL is invalid. Use the complete postgres:// or postgresql:// URL from your database provider, including hostname and database, with valid TLS options.');
  }

  const host = parameters.host.toLowerCase().replace(/\.$/, '');
  if (isProduction && (host === 'localhost' || host.endsWith('.localhost')
      || /^127\./.test(host) || ['::1', '[::1]', '0.0.0.0'].includes(host)
      || host.startsWith('/'))) {
    throw new Error('DATABASE_URL must point to your hosted PostgreSQL database in production, not localhost or a local socket.');
  }
}

// pg reads host, port, credentials and SSL directly from the provider URL.
// Individual DB_* settings apply only to local development without a URL.
const connection = databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'grocery_pos',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
        : false
    };

const pool = new Pool({
  ...connection,
  max: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 5 : 10)),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || (process.env.VERCEL ? 5000 : 30000)),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000)
});

// Keep one pool per warm instance and release idle clients before suspension.
if (process.env.VERCEL) {
  attachDatabasePool(pool);
}

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
