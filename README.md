# Expense Reimbursement Management System (ERMS)

KSCAA Tech RRC 2026 — Group 8

Digitizes the end-to-end employee expense claim lifecycle (submission → manager
approval → accounts verification/payment) with role-based dashboards, a
maker-checker approval flow, and a full audit trail.

## Tech stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT access/refresh tokens, session idle timeout, TOTP-based MFA

## Repo layout

```
apps/
  api/     Express backend, one folder per module under src/modules/
  web/     React frontend, one folder per module under src/modules/
packages/
  db/      Prisma schema (single source of truth for the data model) + seed data
docs/
  architecture.md        System overview, data flow, security model
  design-system.md       Colors, typography, component conventions
  workstreams/           One doc per person — read yours first
```

## The 5 workstreams

This project is split into 5 independent pieces so 5 people can work in
parallel, each in their own Claude Code session, on their own git branch:

| # | Branch              | Owns                              | Doc |
|---|----------------------|------------------------------------|-----|
| 1 | `feature/employee`   | Employee dashboard, claims, uploads, notifications | [docs/workstreams/01-employee.md](docs/workstreams/01-employee.md) |
| 2 | `feature/manager`    | Approval queue, review, approve/reject/return       | [docs/workstreams/02-manager.md](docs/workstreams/02-manager.md) |
| 3 | `feature/accounts`   | Verification, duplicate detection, payment          | [docs/workstreams/03-accounts.md](docs/workstreams/03-accounts.md) |
| 4 | `feature/admin`      | Employee/Dept master, approval matrix, roles, users | [docs/workstreams/04-admin.md](docs/workstreams/04-admin.md) |
| 5 | `feature/reports`    | Reports (Excel/PDF/CSV exports, all report types)   | [docs/workstreams/05-reports.md](docs/workstreams/05-reports.md) |

The shared foundation (DB schema, auth, RBAC, audit logging, design system)
is already scaffolded on `main` so no one is blocked waiting on it.

## Getting started (each person)

```bash
git clone https://github.com/kscaa-rrc-2026/group-8.git
cd group-8
git checkout feature/<your-module>     # e.g. feature/employee
npm install
cp .env.example apps/api/.env
cp .env.example packages/db/.env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api      # in one terminal
npm run dev:web      # in another
```

Then open Claude Code from `apps/api/src/modules/<your-module>` or
`apps/web/src/modules/<your-module>` — each has its own `CLAUDE.md` with
scoped context, plus the full workstream doc in `docs/workstreams/`.

Open a PR from your `feature/*` branch into `main` when your module is ready
for review. Do not edit another person's module folder directly — raise it
with them or open a PR against their branch instead.
