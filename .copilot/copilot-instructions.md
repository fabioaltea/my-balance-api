# MyBalance API — Copilot Instructions

## Security Rules

- **NEVER read, open, display, or access `.env`, `.env.*`, or any file containing secrets/API keys.**
- Do not log, output, or reference the content of environment variable files.
- If a user asks to read a `.env` file, remind them that this is blocked by project policy.

## Project Context

This is the **MyBalance API** — the REST backend for MyBalance, a personal finance tracker. Part of the **MySuite** platform. All financial data is stored in the user's personal Google Sheets, NOT in PostgreSQL.

## Tech Stack

- **Runtime**: Node.js + Express.js + TypeScript
- **Data Store**: Google Sheets API v4 (user's personal spreadsheet)
- **Auth**: JWT verified via centralized AuthService at `AUTH_SERVICE_URL`
- **Metadata DB**: PostgreSQL (Neon) — users, sessions, encrypted tokens only
- **Deployment**: Vercel serverless
- **Port**: 8080

## Architecture

- Entry point: `src/index.ts`
- Controllers: `src/controllers/` — accounts, movements, transactions, categories, aggregations, shortcut
- Helpers: `src/helpers/mybalance/` — business logic per entity
- Google helpers: `src/helpers/google/` — auth.helper.ts, sheets.helper.ts
- Middleware: `src/middleware/requireAuth.middleware.ts` — calls AuthService `POST /auth/token/verify`
- Models: `src/models/*.interfaces.ts`
- Routes: `src/routes/*.routes.ts`

## Endpoints (all auth-required)

- **Accounts** `/accounts` (30 req/min): CRUD + batch + balance calculation
- **Movements** `/movements` (50 req/min): CRUD + batch (group of transactions)
- **Transactions** `/transactions` (50 req/min): CRUD + delta + filters (date, account, category, type, status, limit, offset)
- **Categories** `/categories` (60 req/min): CRUD + batch
- **Aggregations** `/aggregations/monthly` (30 req/min): monthly income/expense by category
- **Shortcuts** `/shortcut` (30 req/min): iOS Shortcuts integration (generate key, create movement via x-shortcutkey header)

## Google Sheets Schema

### AllTransactions (A-P)
description | category | amount (EUR, comma: "45,50") | date (dd-MM-yyyy) | type (in/out) | account | status (ACTIVE/CONFIRMED/DELETED) | location | notes | transactionId | movementId | recurrenceId | recurrencePattern | dateAdded | dateModified | dateDeleted

### Accounts
name | balance | description | color | textColor | status | dateAdded

### Categories
name | color | icon

## Key Patterns

- `GoogleAuthHelper.executeWithRetry()` wraps all Sheets API calls (auto-refresh on 401)
- Soft delete: status = DELETED + dateDeleted timestamp
- Amount format: EUR with comma decimals ("45,50"), parsed removing € and dot thousands separators
- Type inference: "in"/"out" or inferred from amount sign
- Date format: dd-MM-yyyy (movements), yyyy-MM-dd hh:mm (metadata)
- Custom `spreadsheet_id` query param or `x-shortcutkey` header for shortcut auth

## Build & Dev

```bash
pnpm install
pnpm run start        # Dev with nodemon
pnpm run build        # TypeScript → dist/
pnpm run ts.check     # Type check only
```

Pre-commit hooks: type-check → build → stage dist/
