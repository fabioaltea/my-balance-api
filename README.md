# MyBalance API

REST API backend for MyBalance — a personal finance tracker that stores all financial data in the user's Google Sheets.

## Tech Stack

- **Runtime**: Node.js + Express.js + TypeScript
- **Data Store**: Google Sheets API v4 (user's personal spreadsheet)
- **Auth**: JWT verified via centralized AuthService
- **Metadata DB**: PostgreSQL (Neon) — users, sessions, encrypted tokens
- **Deployment**: Vercel (serverless)
- **Port**: 8080

## API Endpoints

All endpoints require JWT authentication (except health check and waitlist).

### Accounts (`/accounts`) — 30 req/min
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/accounts` | List accounts (optional `calculate_balance` param) |
| POST | `/accounts` | Create account |
| POST | `/accounts/batch` | Batch create accounts |
| GET | `/accounts/:id` | Get single account |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |

### Movements (`/movements`) — 50 req/min
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/movements` | List movements (grouped transactions) |
| POST | `/movements` | Create movement |
| POST | `/movements/batch` | Batch update movements |
| GET | `/movements/:id` | Get single movement |
| PUT | `/movements/:id` | Update movement |
| DELETE | `/movements/:id` | Delete movement |

### Transactions (`/transactions`) — 50 req/min
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/transactions` | List with filters (from_date, to_date, account, category, type, status, limit, offset) |
| GET | `/transactions/delta` | Changed transactions since timestamp |
| POST | `/transactions` | Create transaction |
| GET | `/transactions/:id` | Get single transaction |
| PUT | `/transactions/:id` | Update transaction |
| DELETE | `/transactions/:id` | Delete transaction |

### Categories (`/categories`) — 60 req/min
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| POST | `/categories/batch` | Batch create categories |
| GET | `/categories/:id` | Get single category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |

### Aggregations (`/aggregations`) — 30 req/min
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/aggregations/monthly` | Monthly income/expense by category |

### iOS Shortcuts (`/shortcut`) — 30 req/min
| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/shortcut/generate` | JWT | Generate shortcut key |
| GET | `/shortcut/key` | JWT | Get current shortcut key |
| POST | `/shortcut/movement` | x-shortcutkey header | Create movement via shortcut |

## Google Sheets Schema

### AllTransactions (columns A-P)
| Col | Field | Format |
|-----|-------|--------|
| A | description | Text |
| B | category | Text |
| C | amount | EUR (comma decimals: "45,50") |
| D | date | dd-MM-yyyy |
| E | type | "in" / "out" |
| F | account | Account name |
| G | status | ACTIVE / CONFIRMED / DELETED |
| H | location | Text |
| I | notes | Text |
| J | transactionId | UUID |
| K | movementId | Groups transactions |
| L | recurrenceId | Recurring link |
| M | recurrencePattern | ISO 8601 duration |
| N | dateAdded | yyyy-MM-dd hh:mm |
| O | dateModified | yyyy-MM-dd hh:mm |
| P | dateDeleted | yyyy-MM-dd hh:mm |

### Accounts
Name, balance, description, color, textColor, status, dateAdded

### Categories
Name, color, icon

## Environment Variables

```env
PORT=8080
AUTH_SERVICE_URL=http://localhost:8082
ALLOWED_ORIGINS=http://localhost:8100,http://localhost:5173
DATABASE_URL=postgresql://...
CLIENT_ID_WEB=
CLIENT_SECRET=
CLIENT_ID_IOS=
CLIENT_ID_ANDROID=
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
ENCRYPTION_KEY=
```

## Development

```bash
pnpm install
pnpm run start        # Dev server with nodemon
pnpm run build        # Compile to dist/
pnpm run ts.check     # Type check
```

## Project Structure

```
src/
├── index.ts
├── controllers/
│   ├── accounts.controller.ts
│   ├── aggregations.controller.ts
│   ├── categories.controller.ts
│   ├── movements.controller.ts
│   ├── shortcut.controller.ts
│   └── transactions.controller.ts
├── helpers/
│   ├── db.helper.ts
│   ├── jwt.helper.ts
│   ├── google/
│   │   ├── auth.helper.ts
│   │   └── sheets.helper.ts
│   └── mybalance/
│       ├── accounts.helper.ts
│       ├── aggregations.helper.ts
│       ├── categories.helper.ts
│       └── transactions.helper.ts
├── middleware/
│   └── requireAuth.middleware.ts
├── models/
│   ├── accounts.interfaces.ts
│   ├── categories.interfaces.ts
│   ├── google.interfaces.ts
│   └── transactions.interfaces.ts
└── routes/
    ├── accounts.routes.ts
    ├── aggregations.routes.ts
    ├── categories.routes.ts
    ├── movements.routes.ts
    ├── shortcut.routes.ts
    └── transactions.routes.ts
```
