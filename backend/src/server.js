require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
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

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  res.status(error.status || 500).json({
    message: error.message || 'Internal server error'
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
