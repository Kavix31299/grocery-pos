require('dotenv').config();

const fs = require('fs');
const path = require('path');
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

const server = app.listen(PORT, () => {
  console.log(`Grocery POS API listening on port ${PORT}`);
});

const shutdown = async () => {
  console.log('Shutting down Grocery POS API...');
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
