# Digital Heroes — Frontend

React 18 + Vite + JavaScript/JSX + React Router + Axios + Tailwind CSS.

The frontend is wired to the Digital Heroes Express API. Business-authoritative identity, subscription entitlement, draw results, prize settlement, and winner ownership remain on the backend.

## Run locally

```bash
npm install
copy .env.example .env
npm run dev
```

Set `VITE_API_URL` to the backend origin, for example:

```env
VITE_API_URL=http://localhost:4000
```

For a deployed backend, use its HTTPS origin.

## Checks and build

```bash
npm run check
npm run build
```

`npm run check` is dependency-free and verifies project structure, relative imports, required deployment files, and accidental secret material. Run it before committing.

## Main routes

Public: `/`, `/charities`, `/charities/:id`, `/draws`, `/draws/:id`, `/login`, `/signup`

Subscriber: `/dashboard`, `/scores`, `/subscription`, `/winnings`, `/settings`

Admin: `/admin`, `/admin/users`, `/admin/subscriptions`, `/admin/draws`, `/admin/winners`, `/admin/charities`

## Backend contract used

- auth: signup, login, refresh, logout, me
- charities: list, detail, admin CRUD/content
- subscriptions: plans, checkout, mine, cancel
- scores: list/create/update/delete
- draws: public list/detail, admin simulate/publish/detail
- winners: mine/proof upload/proof URL, admin review/payout
- admin: users, profile updates, score updates/deletes, subscriptions, reports, config

## Environment and deployment

`.env` is ignored by Git. Only `.env.example` belongs in source control. Production Vercel deployment requires the `VITE_API_URL` environment variable and the included `vercel.json` SPA rewrite.

A normal networked environment should run `npm install`, which creates the local `package-lock.json`; commit that lockfile when preparing the final repository so future installs are reproducible.
