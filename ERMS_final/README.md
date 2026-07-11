# ERMS — Expense Reimbursement Management System

KSCAA Tech RRC 2026 — Group 8

A complete, hardened build of the expense claim lifecycle: submission →
manager approval → accounts verification/payment, with role-based
dashboards, maker-checker approval, audit trail, password management, and
policy enforcement (mandatory bill attachment, per-category spending
limits, duplicate/fraud detection).

## Tech stack

- **Frontend:** React + TypeScript + Vite, Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT with a database-backed rolling idle timeout and
  password-change session invalidation, TOTP-ready MFA fields

## Repo layout

```
apps/
  api/     Express backend — one folder per module under src/modules/
  web/     React frontend — one folder per module under src/modules/
packages/
  db/      Prisma schema (single source of truth for the data model) + seed data
docs/
  architecture.md            System overview, data flow, security model
  design-system.md           Colors, typography, component conventions
  reimbursement-policy.md    Every business rule actually enforced in the code
  judges-faq.pdf             Anticipated Q&A on architecture, security, and decisions
  user-guide.pdf             Step-by-step usage guide per role + end-user FAQ
```

## What's implemented

- **Full claim lifecycle**: Draft → Submit (blocked without a bill
  attachment) → Manager approval (maker-checker, strictly scoped to the
  employee's actual assigned manager, and able to approve less than the
  full claimed amount) → Accounts verification (with duplicate/fraud
  detection that blocks payment on a flagged claim, against the approved
  amount) → Payment. A returned claim can be edited (not just resubmitted
  unchanged) in response to the manager's remarks.
- **Role-based dashboards**: Employee, Manager, Accounts, Admin, and CEO
  (the only role permitted to approve its own claim, since it has no
  manager above it).
- **Notifications**: the manager is notified when a direct report submits
  or resubmits a claim; the employee is notified on every manager/Accounts
  decision and on payment.
- **Security**: bcrypt password hashing, enforced password strength policy,
  mandatory password change on first login/after a reset, session idle
  timeout backed by the database (not a static JWT expiry), and session
  invalidation on password change.
- **Password management**: self-service change, admin-initiated reset,
  and a forgot/reset-password flow.
- **Audit trail**: every mutation — claim actions, payments, logins,
  password changes — is recorded in an append-only log, viewable and
  filterable from the Admin screen.
- **Reports**: Employee-wise, Department-wise, Monthly, Payment, and
  Rejected reports, exportable as CSV.

See `docs/reimbursement-policy.md` for the full list of enforced rules, and
`docs/judges-faq.pdf` for the reasoning behind the major decisions.

## Getting started

```bash
git clone https://github.com/kscaa-rrc-2026/group-8.git
cd group-8/ERMS_final
npm install
cp .env.example apps/api/.env
cp .env.example packages/db/.env
# edit DATABASE_URL in both .env files to point at your PostgreSQL instance
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api      # in one terminal
npm run dev:web      # in another
```

On Windows, `run.bat` automates all of the above — it installs Node.js
and PostgreSQL automatically if either is missing, installs
dependencies, sets up `.env` files, runs migrations/seed, and starts
both servers. Just double-click it or run it from a terminal. If
PostgreSQL was already installed under different credentials than this
project's default, it detects that and prompts you for the correct
password instead of failing. Safe to re-run any time.

### Seeded accounts

| Role | Email | Password |
|---|---|---|
| Employee | employee@erms.local | ChangeMe123! |
| Manager | manager@erms.local | ChangeMe123! |
| Accounts | accounts@erms.local | ChangeMe123! |
| Admin | admin@erms.local | ChangeMe123! |
| CEO | ceo@erms.local | ChangeMe123! |
