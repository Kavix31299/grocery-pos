const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

const getSslConfig = () => {
  if (process.env.DB_SSL === 'true') {
    return {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
    };
  }

  if (process.env.DB_SSL === 'false' || !databaseUrl) {
    return false;
  }

  const sslMode = new URL(databaseUrl).searchParams.get('sslmode');

  if (sslMode === 'disable') {
    return false;
  }

  if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-ca' || sslMode === 'verify-full') {
    return {
      rejectUnauthorized: sslMode === 'verify-ca' || sslMode === 'verify-full'
    };
  }

  return false;
};

const connection = databaseUrl
  ? { connectionString: databaseUrl }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'grocery_pos',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres'
    };

const pool = new Pool({
  ...connection,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  ssl: getSslConfig()
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query
};
