# Grocery POS

A grocery store point-of-sale system with a PostgreSQL database, Express backend API, and React frontend.

## Stack

- PostgreSQL
- Node.js / Express
- React / Vite
- React Router
- Axios

## Sample Login Accounts

These accounts are created by `database/seed.sql`.

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `AdminPass123!` |
| Manager | `manager` | `ManagerPass123!` |
| Cashier | `cashier` | `CashierPass123!` |

Change these passwords before using the app outside local development.

## PostgreSQL Setup

Create the database:

```powershell
createdb -U postgres grocery_pos
```

Run the schema, views, and seed data from the project root:

```powershell
psql -U postgres -d grocery_pos -f database/schema.sql
psql -U postgres -d grocery_pos -f database/views.sql
psql -U postgres -d grocery_pos -f database/seed.sql
```

If you already created the database before the payment-method update, run the migration:

```powershell
psql -U postgres -d grocery_pos -f database/migrations/001_update_payment_methods.sql
```

## Docker Setup

Docker can run PostgreSQL, the backend API, and the frontend together.

Start everything from the project root:

```powershell
docker compose up --build
```

Or run it in the background:

```powershell
docker compose up -d --build
```

Docker services:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend API | `http://localhost:5000` |
| PostgreSQL | `localhost:5433` |

The Docker PostgreSQL container initializes itself with:

- `database/schema.sql`
- `database/views.sql`
- `database/seed.sql`

The Docker backend uses `DB_HOST=db` internally. From your host machine, connect to the Docker database with:

```powershell
psql -U postgres -h localhost -p 5433 -d grocery_pos
```

Default Docker database credentials:

```env
POSTGRES_DB=grocery_pos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

Stop containers:

```powershell
docker compose down
```

Reset Docker database data:

```powershell
docker compose down -v
docker compose up --build
```

If ports are already in use, override them:

```powershell
$env:FRONTEND_PORT=5174
$env:BACKEND_PORT=5001
$env:POSTGRES_PORT=5434
docker compose up --build
```

## Backend Setup

Install dependencies:

```powershell
cd backend
npm install
```

Create the backend environment file:

```powershell
Copy-Item .env.example .env
```

Update `.env` if your PostgreSQL username, password, host, or database name is different.

### Backend Environment Variables

```env
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=grocery_pos
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

JWT_SECRET=change_this_secret_before_production
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=12
```

Start the backend:

```powershell
npm run dev
```

The API runs at:

```text
http://localhost:5000
```

Health checks:

```text
http://localhost:5000/health
http://localhost:5000/health/db
```

## Frontend Setup

Install dependencies:

```powershell
cd frontend
npm install
```

Create the frontend environment file:

```powershell
Copy-Item .env.example .env
```

Frontend environment:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```powershell
npm run dev
```

The app runs at:

```text
http://localhost:5173
```

## Running The Project

Use two terminals.

Terminal 1:

```powershell
cd backend
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

## Database Seed Contents

The seed file creates:

- Roles: Admin, Manager, Cashier
- Store settings
- Admin, Manager, and Cashier users
- Categories
- Suppliers
- Products with stock
- Customers

The seed is written with `ON CONFLICT` clauses so it can be rerun during local development.

## Useful Commands

Build frontend:

```powershell
cd frontend
npm run build
```

Start backend in production mode:

```powershell
cd backend
npm start
```

Reset local database data by recreating the database:

```powershell
dropdb -U postgres grocery_pos
createdb -U postgres grocery_pos
psql -U postgres -d grocery_pos -f database/schema.sql
psql -U postgres -d grocery_pos -f database/views.sql
psql -U postgres -d grocery_pos -f database/seed.sql
```
