#Digital Heroes

A charity-focused Stableford golf platform where subscribers submit scores, support a charity of their choice, and become eligible for monthly prize draws.

## Live Demo & Repository

- **GitHub:** https://github.com/aayushtiwari307/digital-heroes
- **Frontend (Vercel):** https://digital-heroes-dev-d381.vercel.app
- **Backend API (Render):** https://digital-heroes-backend-01z0.onrender.com

## Overview

Digital Heroes is a full-stack membership platform built around a simple idea: play golf, log your Stableford scores, and a portion of your subscription supports a charity you choose. Subscribers with an active plan submit scores, which determine eligibility for a monthly prize draw. Draw results are generated server-side using a seeded, auditable algorithm, and prize payouts follow fixed, transparent tiers. An admin panel handles user, subscription, charity, draw, and winner management.

## Core Features

- User signup and login with JWT access + refresh token authentication
- Password hashing via bcryptjs
- Member dashboard, account, and settings pages
- Charity browsing and charity detail pages
- Membership/subscription plans with a configurable charity contribution percentage
- Stableford score submission (1–45), with date validation and the latest five scores retained per user
- Draw eligibility tied to score history
- Monthly draw simulation and publication, handled separately by admins
- Draw result and winners pages, with prize tiers based on number of matches
- Winner proof-of-win image upload
- Admin panel: user management, subscription oversight, charity CRUD, draw simulation/publishing, winner review
- Stripe Checkout and webhook integration (implemented in code — see Known Limitations)
- Supabase Storage for private winner-proof media

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS |
| Backend | Node.js, Express.js, JavaScript (CommonJS) |
| Database | PostgreSQL (via `pg`), Supabase-hosted in production |
| Auth | Custom JWT access + refresh tokens, bcryptjs |
| Payments | Stripe Checkout + webhooks |
| Storage | Supabase Storage (private bucket, service-role access) |
| Frontend hosting | Vercel |
| Backend hosting | Render |

## Key Business Rules

- The backend is authoritative for all protected business logic — client state is never trusted for authorization or entitlement.
- Subscription entitlement is checked server-side before any score mutation is allowed.
- Score dates are validated server-side, including protection against future-dated entries.
- A user cannot view or modify another user's scores.
- Charity contribution percentage cannot fall below the configured minimum.
- Draw simulation and draw publication are distinct, separately authorized actions.
- Unpublished draw results are not exposed through any public endpoint.
- Draw publishing follows sequential publication constraints.
- Winner proof uploads are validated for file size and actual image content before storage.

## Security & Backend-Authoritative Design

- JWT role claims are never trusted on their own; access to protected admin routes is enforced against server-side authorization checks.
- Stripe payment/subscription state is treated as webhook-authoritative where implemented, not derived from client input.
- The Supabase service-role key is used only on the backend and is never exposed to the frontend.
- The only environment variable the frontend requires is `VITE_API_URL` — no secrets are present in frontend configuration.

## Getting Started

### Prerequisites

- Node.js ≥ 20.19
- npm
- A PostgreSQL database (local instance or Supabase-hosted)
- Git

### Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>
JWT_SECRET=<random string>
JWT_REFRESH_SECRET=<random string>
FRONTEND_URL=http://localhost:5173
STRIPE_SECRET_KEY=<stripe secret key>
STRIPE_WEBHOOK_SECRET=<stripe webhook secret>
SUPABASE_URL=<supabase project url>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
```

Apply migrations and start the API:

```bash
npm run migrate
node src/server.js
```

The API starts on the port set in `PORT` (default `4000`) and exposes a health check at `GET /health`.

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

```bash
npm run dev
```

The app runs at `http://localhost:5173` by default.

## Environment Variables

**Backend**

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `FRONTEND_URL` | Allowed CORS origin |
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (backend only) |

All of the above are required in production; the server fails to start if any are missing when `NODE_ENV=production`.

**Frontend**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the backend API |

## Database & Migrations

`DATABASE_URL` must point to any valid PostgreSQL database — a local instance for development, or a Supabase-hosted instance in production. Running `npm run migrate` from `backend/` applies the project's ordered SQL migrations, which build the schema, seed subscription plans, and apply integrity constraints added over the project's development.

## Testing

Backend:

```bash
npm run test:domain        # unit tests — draw engine, prize engine, score rules
npm run test:integration   # integration tests — requires a running PostgreSQL instance
npm run audit:static       # static backend audit
```

Frontend:

```bash
npm run check   # frontend consistency check
npm run build   # production build
```

**Verified results:** 26/26 domain unit tests and 76/76 integration tests pass against a live PostgreSQL instance. The static backend audit completes successfully. The frontend build completes successfully with 0 vulnerabilities reported by `npm audit` on the finalized dependency set.

## Deployment

| Layer | Platform |
|---|---|
| Frontend | Vercel — SPA routing handled via `vercel.json` rewrites |
| Backend | Render |
| Database | Supabase-hosted PostgreSQL |
| Storage | Supabase Storage (private bucket) |
| Payments | Stripe Checkout + webhooks |

## Current Verification Status & Known Limitations

The backend has been thoroughly tested: full migrations apply cleanly, and the complete unit and integration suites (102 tests total) pass against a real PostgreSQL database. The frontend builds cleanly and is deployed and publicly reachable.

Manual smoke testing on the deployed environment confirmed: home, dashboard, account, membership, and draws pages load; signup and login work; an incorrect password is correctly rejected; logout works; the scores page loads; and score submission is correctly blocked when a user has no active subscription.

Two areas are implemented but not yet fully verified end-to-end in the deployed environment:

- **Charities:** the deployed environment currently has zero active charity records, so the charity selection and contribution flow could not be fully exercised.
- **Stripe:** Checkout and webhook handling are implemented in the codebase, but a complete live payment flow has not yet been verified, as Stripe account setup is still pending.

## License

No license file is currently included in this repository.

## Author

Built by [Aayush Tiwari](https://github.com/aayushtiwari307)
