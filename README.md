# Hotel Management System API

Production-ready backend API for a multi-module hotel operations platform built with Node.js, Express, and TypeScript.

This project includes domain modules for reservations, rooms, rates, folio and POS, inventory, housekeeping, maintenance, communications, channel manager integrations, reporting, and authentication/authorization.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Snapshot](#architecture-snapshot)
4. [Module to Route Matrix](#module-to-route-matrix)
5. [Getting Started (Local Development)](#getting-started-local-development)
6. [API Documentation](#api-documentation)
7. [Scripts](#scripts)
8. [Docker](#docker)
9. [Environment Variables](#environment-variables)
10. [Testing](#testing)
11. [Background Workers](#background-workers)
12. [Development Workflow](#development-workflow)
13. [Contributing](#contributing)
14. [License](#license)

---

## Project Overview

The API is organized by feature modules under `src/api`, with each module owning its controller/service/repository/schema/types and route wiring.

High-level capabilities:
- Authentication and authorization (JWT + permission-based access control)
- Organization and hotel management
- Rooms, room types, rate plans, reservations, check-in/check-out
- Folio and POS operations
- Inventory and maintenance workflows
- Housekeeping workflows
- Night audit and reporting
- Guest communications and channel manager integration

---

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 4
- **Language**: TypeScript 5
- **Validation**: Zod
- **Database ORM**: Prisma
- **Database**: PostgreSQL
- **Docs**: Swagger UI / OpenAPI
- **Logging**: Winston
- **Lint/Format**: Biome
- **Testing**: Vitest + Supertest
- **Containers**: Docker + Docker Compose

---

## Architecture Snapshot

```text
src/
├── app.ts
├── server.ts
├── api/
│   ├── auth/
│   ├── channelManager/
│   ├── checkinCheckout/
│   ├── communications/
│   ├── folio/
│   ├── guests/
│   ├── health/
│   ├── hotel/
│   ├── housekeeping/
│   ├── inventory/
│   ├── maintenance/
│   ├── nightAudit/
│   ├── notification/
│   ├── organizations/
│   ├── pos/
│   ├── ratePlans/
│   ├── reports/
│   ├── reservations/
│   ├── roomTypes/
│   ├── rooms/
│   └── user/
├── api-docs/
├── config/
├── core/
├── database/
├── generated/prisma/
└── routes/
    └── registerRoutes.ts

prisma/
└── schema.prisma

tests/
├── unit/
└── integration/
```

Design principles:
- Feature-first modular structure
- Centralized route registration in `src/routes/registerRoutes.ts`
- Typed config and environment validation in `src/config`
- Shared infrastructure in `src/core`

---

## Module to Route Matrix

API prefix is configurable via `API_PREFIX` + `API_VERSION` (default: `/api/v1`).

| Module | Route Mount Path | Notes |
| --- | --- | --- |
| Health | `/health` | Unversioned health endpoint |
| Communications Webhooks | `/webhooks/communications` | Non-production only |
| Channel Webhooks | `/webhooks/channels` | Non-production only |
| Users | `/api/v1/users` | User and permission APIs |
| Organizations | `/api/v1/organizations` | Organization-level APIs |
| Auth | `/api/v1/auth` | Login, token, MFA flows |
| Hotels | `/api/v1/hotels` | Hotel-level resources |
| Rooms | `/api/v1/organizations/:organizationId/hotels/:hotelId/rooms` | Room inventory/state |
| Room Types | `/api/v1/organizations/:organizationId/hotels/:hotelId/room-types` | Room class definitions |
| Rate Plans | `/api/v1/organizations/:organizationId/hotels/:hotelId/rate-plans` | Pricing models/rates |
| Reservations | `/api/v1/organizations/:organizationId/hotels/:hotelId/reservations` | Reservation lifecycle |
| Reservation Communications | `/api/v1/organizations/:organizationId/hotels/:hotelId/reservations/:reservationId/communications` | Reservation-scoped communication |
| Folio | `/api/v1/organizations/:organizationId/hotels/:hotelId` | Mounted under hotel scope |
| Check-in/Checkout | `/api/v1/organizations/:organizationId/hotels/:hotelId` | Mounted under hotel scope |
| Night Audit | `/api/v1/organizations/:organizationId/hotels/:hotelId` | Mounted under hotel scope |
| POS | `/api/v1/organizations/:organizationId/hotels/:hotelId/pos` | Point-of-sale |
| Inventory | `/api/v1/organizations/:organizationId/hotels/:hotelId/inventory` | Stock/procurement |
| Housekeeping | `/api/v1/organizations/:organizationId/hotels/:hotelId/housekeeping` | Task and room workflow |
| Maintenance | `/api/v1/organizations/:organizationId/hotels/:hotelId/maintenance` | Requests/schedules/escalation |
| Reports | `/api/v1/organizations/:organizationId/hotels/:hotelId` | Mounted under hotel scope |
| Guests (Org) | `/api/v1/organizations/:organizationId/guests` | Organization guest profiles |
| Guests (In-House) | `/api/v1/organizations/:organizationId/hotels/:hotelId/guests` | Hotel-scoped guests |
| Communications (Org) | `/api/v1/organizations/:organizationId/communications` | Templates/messages |
| Channel Manager | `/api/v1/organizations/:organizationId/hotels/:hotelId/channels` | Channel connections/sync |

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL (local or containerized)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

```bash
# macOS/Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Update required values in `.env`:
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ENCRYPTION_KEY`

### 3) Prepare database and Prisma client

```bash
npx prisma generate
npx prisma migrate deploy
```

For iterative local schema work, you can use `npx prisma migrate dev` instead.

### 4) Start the API

```bash
npm run dev
```

Server defaults:
- API: `http://localhost:3000/api/v1`
- Health: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/api-docs`

---

## API Documentation

- **Swagger UI**: `GET /api-docs`
- **OpenAPI JSON**: `GET /api-docs/swagger.json`

OpenAPI routes are provided by `src/api-docs/openAPIRouter.ts`.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start development server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start compiled app (`node dist/server.js`) |
| `npm run lint` | Run Biome lint checks |
| `npm run lint:fix` | Run Biome lint auto-fixes |
| `npm run format` | Format source and tests |
| `npm run format:check` | Check formatting without writing |
| `npm run check` | Run Biome check |
| `npm run check:fix` | Run Biome check with fixes |
| `npm run typecheck` | TypeScript no-emit typecheck |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest with coverage |

---

## Docker

### Production image

```bash
docker build -t hotel-management-api .
docker run -p 3000:3000 --env-file .env hotel-management-api
```

### Docker Compose

```bash
# Production API service
docker compose up -d api

# Development profile (api-dev + postgres)
docker compose --profile dev up --build api-dev

# Stop and clean up
docker compose down
```

Notes:
- `api-dev` runs with hot reload and Prisma generate command.
- The `postgres` service is configured under the `dev` profile.

---

## Environment Variables

Full reference lives in `.env.example`. Key settings are below.

### Required (no default)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token signing secret (min 32 chars) |
| `ENCRYPTION_KEY` | Application encryption key (min 32 chars) |

### Core app configuration

| Variable | Default |
| --- | --- |
| `NODE_ENV` | `development` |
| `PORT` | `3000` |
| `HOST` | `localhost` |
| `API_PREFIX` | `/api` |
| `API_VERSION` | `v1` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |
| `LOG_LEVEL` | `info` |
| `CORS_ORIGIN` | `*` |

### Database/runtime tuning

| Variable | Default |
| --- | --- |
| `DB_POOL_MIN` | `2` |
| `DB_POOL_MAX` | `20` |
| `DB_CONNECTION_TIMEOUT` | `10000` |
| `DB_IDLE_TIMEOUT` | `30000` |
| `LOG_QUERIES` | `false` |

### Auth/system/scheduler

| Variable | Default |
| --- | --- |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `SUPER_ADMIN_EMAIL` | `admin@hms.local` |
| `SUPER_ADMIN_PASSWORD` | `SuperAdmin123!@#` |
| `SYSTEM_USER_ID` | `00000000-0000-0000-0000-000000000000` |
| `MAINTENANCE_ESCALATION_CHECKER_ENABLED` | `true` |
| `MAINTENANCE_ESCALATION_CHECKER_INTERVAL_MS` | `300000` |
| `MAINTENANCE_ESCALATION_CHECKER_BATCH_SIZE` | `100` |

### Optional Redis settings

| Variable | Default |
| --- | --- |
| `REDIS_HOST` | `localhost` |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | _(optional)_ |

---

## Testing

Current test layout:

```text
tests/
├── setup.ts
├── unit/
│   ├── health/
│   ├── housekeeping/
│   ├── maintenance/
│   └── user/
└── integration/
    ├── housekeeping/
    └── user/
```

Run tests:

```bash
npm test
npm run test:watch
npm run test:coverage
```

Run a specific test file:

```bash
npm test -- tests/unit/user/user.service.test.ts
```

Some integration tests may require a reachable database and corresponding env configuration.

---

## Background Workers

On server startup (`src/server.ts`), the app starts:
- **Outbox worker** (`startOutboxWorker`)
- **Maintenance scheduler** (`startMaintenanceScheduler`)

Both are stopped gracefully during shutdown.

---

## Development Workflow

Recommended flow:
1. Pull latest changes
2. Install dependencies (`npm install`)
3. Ensure `.env` is valid
4. Regenerate Prisma client if schema changed (`npx prisma generate`)
5. Run checks:
   - `npm run lint`
   - `npm run build`
   - `npm test`

---

## Contributing

1. Create a feature branch
2. Implement changes with tests when applicable
3. Run lint/build/test locally
4. Open a pull request with a clear summary

---

## License

MIT
