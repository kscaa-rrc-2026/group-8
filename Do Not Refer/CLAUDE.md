# ERMS — root project context

Expense Reimbursement Management System. See [README.md](README.md) for repo
layout and [docs/architecture.md](docs/architecture.md) for the full design.

## Stack

- API: Express + TypeScript, `apps/api`
- Web: React + TypeScript + Vite + Tailwind, `apps/web`
- DB: PostgreSQL via Prisma, schema lives in `packages/db/prisma/schema.prisma`
  — this is the single source of truth for the data model. If a module needs
  a new field or table, propose the change there, don't duplicate types.

## Conventions

- One module = one folder (`apps/api/src/modules/<name>`,
  `apps/web/src/modules/<name>`). Stay inside your module folder unless a
  task explicitly requires touching shared code (`src/middleware`,
  `src/components/layout`, `packages/db`) — coordinate before changing those.
- Every mutation on Claim/ApprovalStep/Payment/Employee/Department must go
  through the `auditLog` middleware/helper (`apps/api/src/middleware/auditLog.ts`)
  — audit logs are immutable and required on every create/update/soft-delete.
  No hard deletes: use `deletedAt` (soft delete) on every model that has it.
  Approve/reject/return endpoints must reject the request if `remarks` is
  missing.
- Role-based access is enforced server-side via the `rbac` middleware
  (`apps/api/src/middleware/rbac.ts`) — never rely on the frontend hiding a
  button as the only access control.
- Duplicate claim detection (`packages/db` `Attachment.fileHash` +
  amount/date/employee comparison) happens before a claim reaches
  `ACCOUNTS_VERIFIED`, not after payment.
- Frontend: use the design tokens in `apps/web/src/index.css` /
  `tailwind.config.ts` (see [docs/design-system.md](docs/design-system.md))
  instead of ad-hoc colors/fonts — keep the professional, consistent look
  across all 5 role dashboards.
- API responses: `{ data, error }` shape; errors go through
  `apps/api/src/middleware/errorHandler.ts`, don't throw raw strings.

## Per-module context

Each module folder has its own `CLAUDE.md` with the scope for that person's
piece. Read [docs/workstreams/](docs/workstreams/) for the full spec
(DB tables owned, API contracts, screens, definition of done) before
starting.
