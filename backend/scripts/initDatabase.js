require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const databasePath = path.resolve(__dirname, '../../database');
const migrationsPath = path.join(databasePath, 'migrations');

const readSql = (filename) => fs.readFileSync(path.join(databasePath, filename), 'utf8');

const migrationFiles = fs.existsSync(migrationsPath)
  ? fs.readdirSync(migrationsPath).filter((filename) => filename.endsWith('.sql')).sort()
  : [];

const initializeDatabase = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const schemaResult = await client.query(
      "SELECT to_regclass('public.roles') IS NOT NULL AS initialized"
    );

    if (!schemaResult.rows[0].initialized) {
      await client.query(readSql('schema.sql'));
      await client.query(readSql('views.sql'));
      await client.query(readSql('seed.sql'));

      for (const filename of migrationFiles) {
        await client.query(
          'INSERT INTO app_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [filename]
        );
      }

      console.log('Database schema and seed data initialized.');
    } else {
      for (const filename of migrationFiles) {
        const migrationResult = await client.query(
          'SELECT 1 FROM app_migrations WHERE filename = $1',
          [filename]
        );

        if (migrationResult.rowCount === 0) {
          await client.query(fs.readFileSync(path.join(migrationsPath, filename), 'utf8'));
          await client.query('INSERT INTO app_migrations (filename) VALUES ($1)', [filename]);
          console.log(`Applied database migration: ${filename}`);
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});
