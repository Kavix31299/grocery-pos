require('./config/env');

const fs = require('fs');
const path = require('path');
const { createHash, timingSafeEqual } = require('node:crypto');
const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const usersRoutes = require('./routes/usersRoutes');
const categoriesRoutes = require('./routes/categoriesRoutes');
const productsRoutes = require('./routes/productsRoutes');
const suppliersRoutes = require('./routes/suppliersRoutes');
const customersRoutes = require('./routes/customersRoutes');
const purchasesRoutes = require('./routes/purchasesRoutes');
const salesRoutes = require('./routes/salesRoutes');
const returnsRoutes = require('./routes/returnsRoutes');
const expensesRoutes = require('./routes/expensesRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const storeSettingsRoutes = require('./routes/storeSettingsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const clientOrigin = process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || '*';
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexPath = path.join(frontendDistPath, 'index.html');

// TEMPORARY: remove after the production database target is verified.
// Only the SHA-256 verifier is stored here; the private token stays outside the repository.
const DATABASE_DIAGNOSTIC_TOKEN_SHA256 = '7319deef7f42d9fcb219dbdb64ea2c78beeb91970d027c8773e115ab94c33b1a';
const DATABASE_DIAGNOSTIC_EXPIRES_AT = Date.parse('2026-10-01T22:48:39.309Z');
const DATABASE_DIAGNOSTIC_SQL = `
SELECT
  pg_catalog.current_database()::text AS current_database,
  current_user::text AS current_user,
  pg_catalog.current_setting('search_path') AS search_path,
  pg_catalog.current_schema()::text AS current_schema,
  pg_catalog.to_regclass('users')::text AS unqualified_users,
  pg_catalog.to_regclass('public.users')::text AS public_users;
`;

// Handle this path before body parsing and authentication that reads application tables.
app.all('/api/diagnostics/database-target', async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.set('Allow', 'GET').status(405).json({ error: 'method_not_allowed' });
  }

  const suppliedToken = req.get('X-Database-Diagnostic-Token');
  if (Date.now() >= DATABASE_DIAGNOSTIC_EXPIRES_AT
      || typeof suppliedToken !== 'string'
      || !/^[a-f0-9]{64}$/.test(suppliedToken)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const suppliedDigest = createHash('sha256').update(suppliedToken).digest();
  const expectedDigest = Buffer.from(DATABASE_DIAGNOSTIC_TOKEN_SHA256, 'hex');
  if (!timingSafeEqual(suppliedDigest, expectedDigest)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const { rows } = await pool.query(DATABASE_DIAGNOSTIC_SQL);
    const row = rows[0];
    return res.json({
      current_database: row.current_database,
      current_user: row.current_user,
      search_path: row.search_path,
      current_schema: row.current_schema,
      unqualified_users: row.unqualified_users,
      public_users: row.public_users
    });
  } catch {
    // Do not log or forward connection errors: their details may contain credentials.
    return res.status(503).json({ error: 'database_diagnostic_failed' });
  }
});

app.use(cors({
  origin: clientOrigin,
  credentials: clientOrigin !== '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/returns', returnsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/store-settings', storeSettingsRoutes);

app.get('/api', (req, res) => {
  res.json({
    message: 'Grocery POS API is running',
    status: 'ok'
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health/db', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');

    res.json({
      status: 'ok',
      database: 'connected',
      currentTime: result.rows[0].current_time
    });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(frontendIndexPath)) {
  app.use(express.static(frontendDistPath));

  app.use((req, res, next) => {
    const isFrontendRoute = req.method === 'GET'
      && !req.path.startsWith('/api')
      && !req.path.startsWith('/health');

    if (isFrontendRoute) {
      return res.sendFile(frontendIndexPath);
    }

    return next();
  });
}

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    ...(error.details ? { details: error.details } : {})
  });
});

// Vercel imports the app; direct execution keeps local and Docker startup working.
module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Grocery POS API listening on port ${PORT}`);
  });

  const shutdown = () => {
    console.log('Shutting down Grocery POS API...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
