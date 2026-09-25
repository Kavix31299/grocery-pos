# Vercel Services + Neon deployment

## Repository and routing

- No root `package.json`; install and run commands in each service.
- `frontend/`: React/Vite, `npm run build` produces `frontend/dist`.
- `backend/`: Express/CommonJS. Both `main` and `start` in its package point to `src/server.js`.
- `database/`: current schema, report views, reference data, demo seed and historical migrations.
- Root `vercel.json` already specifies `services.backend.entrypoint: "src/server.js"`, relative to `backend/`. Keep the Services format.
- `/api` and `/api/*`, plus `/health` and `/health/*`, route to Express with the original path preserved. Everything else routes to Vite, with an HTML fallback for React Router.
- Express exports the app for Vercel and listens on `PORT` (default 5000) when started directly. Local development, Docker and the legacy Render startup remain supported.

## Vercel settings

1. Keep **Application/Framework Preset: Services**.
2. Set **Root Directory** to the repository root, not `frontend` or `backend`.
3. Use **Node.js 24.x**, matching both package engine requirements.
4. Leave project-wide build/install/output overrides unset. Each service uses its package and framework defaults. Do not use `start:render` as a build command.
5. Check that Neon injects the pooled `DATABASE_URL` into both Production and Preview. Do not copy a URL into repository configuration. Check which Neon branch each environment uses; initialize each distinct fresh database that the app will use.
6. Set `JWT_SECRET` securely for both environments. A stable, randomly generated secret of at least 32 bytes is suitable; never put it in a `VITE_*` variable.
   Set `NODE_ENV=production` for the backend runtime. Vercel's automatic `VERCEL` flag also enforces production database validation.
7. Remove old Render database overrides, `DB_SSL=false`, `DB_SSL_REJECT_UNAUTHORIZED=false`, and any obsolete frontend URL setting from Vercel. No manual SSL variables are needed with Neon's supplied SSL-enabled URL.
8. Deploy the branch/commit containing these files. If the old entrypoint error recurs, check the deployment's source commit and root directory: this checkout already contains the entrypoint.

Do not expose a fresh deployment publicly until its first administrator exists. The existing registration endpoint allows the first user to become Admin. Use Vercel Deployment Protection during setup, or provision that account through a locally running backend connected securely to Neon before deploying publicly.

## Environment variable inventory

Only names and non-secret defaults are documented here. `.env` and `.vercel/` are Git-ignored. Vercel's environment settings supply runtime secrets; no tracked `.env` file is needed.

### Backend

| Name | Required on Vercel? | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes, supplied by Neon integration | Pooled PostgreSQL connection string. Already the variable used by the application. |
| `NODE_ENV` | Set to `production` | Disables local `.env` loading and requires a hosted database URL. |
| `JWT_SECRET` | Yes, configure manually | Token signing and verification; no application fallback. |
| `JWT_EXPIRES_IN` | Optional | Token lifetime; default `1d`. |
| `BCRYPT_SALT_ROUNDS` | Optional | Password hashing work factor; default `12`. |
| `CLIENT_ORIGIN` | Optional | Explicit CORS origin for cross-origin clients. Same-domain `/api` calls need no override. A fixed Production origin does not describe Preview origins. |
| `DB_POOL_MAX` | Optional | Connections per instance; default `5` on Vercel, `10` locally. |
| `DB_IDLE_TIMEOUT_MS` | Optional | Idle timeout; default `5000` on Vercel, `30000` locally. |
| `DB_CONNECTION_TIMEOUT_MS` | Optional | Connection acquisition timeout; default `5000`. |
| `DB_SSL` | Optional; leave unset for Neon | Used only for local connections without DATABASE_URL. URL connections delegate SSL to pg. |
| `DB_SSL_REJECT_UNAUTHORIZED` | Optional; leave unset for Neon | Used only for local connections without DATABASE_URL and with DB_SSL=true; verification defaults to enabled. |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | No | Legacy/local connection fields when `DATABASE_URL` is absent. Do not configure them for Neon. |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGSSLMODE` | No | Driver-level fallback settings. Remove stale local values and use the complete provider URL, including its TLS parameters. |
| `PORT` | No | Direct local/standalone listener only. |
| `RENDER_EXTERNAL_URL` | No | Legacy Render-only CORS fallback, retained for compatibility. |
| `VERCEL` | Automatic | Enables Vercel pool defaults and idle connection cleanup. Do not configure manually. |

The installed `pg` library parses SSL parameters in `DATABASE_URL`; these take precedence over the separate SSL object. Its current locked version verifies certificates for Neon's `sslmode=require`. Keep the integration URL intact. Never disable certificate verification to resolve a deployment error.

One module-level `pg.Pool` is reused across requests. `@vercel/functions` attaches its idle cleanup hook on Vercel. Transaction clients already release in `finally`; the app does not end the pool after individual requests. No new ORM or Neon driver is required.

When `NODE_ENV=production`, `VERCEL` is set, or `RENDER=true`, a missing or blank `DATABASE_URL` causes an explicit configuration error before a pool is created. A URL must use `postgres://` or `postgresql://` and include a hostname and database. Production rejects localhost, loopback and local-socket destinations, including `host` query overrides. Configuration errors do not print the URL or underlying parser error. Only non-production local connections may fall back to individual `DB_*` fields. With `DATABASE_URL` set, the pool receives `connectionString` and pooling options only; `DB_HOST`, `DB_PORT` and `DB_SSL` are not mixed into URL connections. If an older deployment reports `ECONNREFUSED 127.0.0.1:5432`, it is trying the local database fallback (or has an incorrect localhost URL). Check the exact `DATABASE_URL` variable name, its Production/Preview scope, and the Neon connection for this project. A prefixed variable or `POSTGRES_URL` alone is not read by this app. Redeploy the latest source after correcting environment settings; existing deployments retain their previous environment. Never share the variable's value in screenshots or logs.

### Frontend

| Name | Required on Vercel? | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Used only during development; default `http://localhost:5000/api`. Production builds always use `/api`. |
| `import.meta.env.PROD` | Automatic Vite flag | Selects the production API path; not a variable to configure. |

`NODE_ENV` is read by backend environment loading and database validation. Never expose backend secrets through Vite-prefixed variables.

## Initialize a fresh Neon database

Use **Neon SQL Editor** for the database/branch linked to the intended Vercel environment. No connection string needs to be pasted into commands or source files.

Run the following **once, in this exact order**, stopping on any error:

1. `database/schema.sql`: 17 tables, constraints, indexes and timestamp triggers.
2. `database/views.sql`: 12 report views, including `customer_credit_report`.
3. `database/bootstrap.sql`: required Admin/Manager/Cashier roles and one default store settings row. No accounts, passwords, products, customers or transactions are inserted.

For atomic initialization, paste the contents of those three files into one SQL Editor query in that order, preceded by `BEGIN;` and followed by `COMMIT;`.

**Fresh databases only:** `views.sql` starts with `DROP VIEW IF EXISTS ... CASCADE`. After creating the schema in an empty database, no views exist to remove. Do not rerun it on a populated database without reviewing its dependent objects. `schema.sql` is not idempotent. No `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, or historical migration is needed for this fresh initialization.

`bootstrap.sql` can be rerun safely: it uses `ON CONFLICT DO NOTHING` and preserves existing roles/settings.

### Historical migrations and optional data

| File | Already included in the fresh baseline? |
| --- | --- |
| `001_update_payment_methods.sql` | Yes: payment-method constraint in `schema.sql`. |
| `002_decimal_quantities.sql` | Yes: decimal stock/quantities in `schema.sql`, reports in `views.sql`. This migration drops/recreates views; skip it. |
| `003_add_wholesale_price.sql` | Yes: wholesale column and constraint. |
| `004_add_retail_price.sql` | Yes: retail column and constraint. |
| `005_add_printer_settings.sql` | Yes: all printer columns and port constraint. |
| `006_add_customer_credit_report.sql` | Yes: same view in `views.sql`. |

These numbered files are upgrades for older databases, not extra steps for a fresh Neon database. Their numeric order matters when upgrading an old installation. That operation is outside this fresh-database setup.

`database/seed.sql` is **optional local/demo data**. It includes roles/settings and three demo staff accounts with preset password hashes. It also overwrites existing matching account hashes/settings when rerun. Do not run it in production. It contains no sample categories, suppliers, products or customers.

`backend/scripts/initDatabase.js` is the legacy Render initializer. On a fresh database it loads schema, views and the demo seed, then records the numbered migrations as already included. On an existing database it runs unrecorded migrations. Do not run it against Neon for this workflow and do not add it to Vercel startup/build. The app does not require its `app_migrations` tracking table at runtime.

### First administrator

The UI has a login form but no initial registration screen. Use the existing `POST /api/auth/register` endpoint with `fullName`, `username`, `email`, and a unique `password` of at least eight characters. With zero users, the backend assigns Admin automatically; afterward only an authenticated Admin can register staff.

Submit through an API client authorized to access the protected deployment, or through a local backend securely connected to Neon. Keep passwords in the client's private request input, not tracked files, shell history or shared logs. Then sign in at `/login`, update Store Settings, and add real staff/master data through the application before removing setup protection.

Read-only SQL verification:

```sql
SELECT role_name FROM roles ORDER BY role_name;
SELECT setting_id, store_name FROM store_settings;
SELECT COUNT(*) AS staff_count FROM users;
SELECT COUNT(*) AS report_count
FROM information_schema.views
WHERE table_schema = 'public';
```

Expected: three roles, one settings row, zero staff before initial registration, and twelve report views.

## Local commands and deployment verification

From the repository root, if dependencies are not installed:

```powershell
npm --prefix backend ci
npm --prefix frontend ci --include=dev
```

Run checks:

```powershell
npm --prefix backend test
npm --prefix frontend run build
git diff --check
```

Backend deployment tests run with isolated environments and no remote database access. Neither package has a lint script; the frontend has no test script.

Local development, in separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

`backend/src/config/env.js` resolves the ignored `backend/.env` relative to its own location, so `npm --prefix backend run dev` and `node backend/src/server.js` work from the repository root too. Existing shell variables take precedence. Production, Vercel, Render and tests skip `.env` loading entirely; deployment secrets must be set in the backend runtime environment. The server, shared pool and database initializer all use this loader.

Vercel CLI was not installed in the inspected environment, and this checkout was not linked locally. A cloud-backed `vercel build` was therefore not run. If using the CLI later, link to the **existing** project and use `vercel pull` and `vercel build`; downloaded environment files stay under ignored `.vercel/`. Do not paste their contents into logs or commit them. Pushing the reviewed changes to the connected Git branch can trigger deployment without installing the CLI.

The deployment test suite checks environment isolation, URL precedence and validation, credential-safe errors, provider TLS behavior, local/Docker connections, Vercel app exports, protected routes and standalone `PORT` handling without connecting to a remote database. Passing these tests and the frontend build does not verify the deployed database; complete the hosted health and login checks below.

The unchanged `vercel.json` passes JSON parsing and the published Vercel schema rules. The upstream schema declares draft-04 but contains newer numeric `exclusiveMinimum` rules, so validation used draft-07 compatibility in memory. No repository configuration was changed for that validator mismatch. Actual cloud service builds and CDN behavior still need the deployed checks below.

After deployment check:

- `/api` and `/health`: HTTP 200 JSON.
- `/health/db`: HTTP 200 with `database: connected` (this checks connectivity, not schema completeness).
- `/login`: loads, and refreshing it still loads the SPA.
- Browser requests target the current deployment's `/api`, including on Preview domains.
- Login, Store Settings, products and reports work after initialization.
- Existing static assets, including `/epson/epos-2.27.0.js`, return JavaScript rather than the SPA fallback.

## Retained Render and Docker files

No hardcoded `onrender.com` URL was found in tracked application/configuration files. `render.yaml`, the `start:render` script and `RENDER_EXTERNAL_URL` fallback are retained as legacy hosting support; Vercel does not use them. The Render Blueprint supplies `DATABASE_URL` from its same-region private database. Its existing `DB_SSL=false` setting is unnecessary for URL connections and must not be copied to Neon. Render's internal connection supports non-TLS connections; external database connections require TLS. Configure external TLS in the provider URL, not by globally disabling certificate verification.

The backend Docker image defaults to `NODE_ENV=production` and uses `npm start`. The local `docker-compose.yml` explicitly overrides these with `NODE_ENV=development` and `npm run dev`, retaining watch mode and its local PostgreSQL service. For a standalone production container, supply `DATABASE_URL`, `JWT_SECRET`, and the platform's `PORT`; the image's `EXPOSE 5000` is only metadata.

The repository-wide database search found one shared pool (`backend/src/config/db.js`), used by authentication, every database controller, transactions and the legacy initializer. Remaining `localhost`/`5432` references are local-only DB defaults, Docker wiring, development examples, tests, the frontend's development API default, and incidental matches in the third-party Epson SDK. No UI files were changed for this database fix. The ignored local `.env` was inspected without printing credentials and was left unchanged.

## References

- [Vercel Services configuration and routing](https://vercel.com/kb/guide/vercel-services)
- [Express app exports and port listeners on Vercel](https://vercel.com/docs/frameworks/backend/express)
- [Vercel connection pool lifecycle](https://vercel.com/kb/guide/connection-pooling-with-functions)
- [node-postgres SSL configuration precedence](https://node-postgres.com/features/ssl)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Render internal and external PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting)
