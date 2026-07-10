# API — Admin module

Owns: Employee & Department Master, Approval Matrix, Roles, User Management.
Full spec: [docs/workstreams/04-admin.md](../../../../../docs/workstreams/04-admin.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md))

`service.ts` has employee create/deactivate fully implemented as the
reference pattern (hash password → write → audit log). Department and
Approval Matrix CRUD are wired directly in `routes.ts` for now — pull them
into `service.ts` once they grow beyond simple create/list.

Roles today are the fixed `Role` enum in `packages/db/prisma/schema.prisma`
(`EMPLOYEE`, `MANAGER`, `ACCOUNTS`, `ADMIN`), assigned per-employee. "Roles"
screen = employee role field + this module's employee CRUD, not a separate
permissions table — don't add one unless a real requirement for
finer-grained permissions shows up.

Still open in this module:
- Employee update (name/department/manager/role change) — only create and
  deactivate exist right now.
- Approval Matrix validation: reject overlapping min/max ranges for the
  same department + sequence.
- User Management: password reset flow, MFA enrollment
  (`Employee.mfaSecret`/`mfaEnabled` — see `otplib` already in
  `apps/api/package.json`).

Every mutation here needs an audit log entry — this module manages the
most security-sensitive data in the system (who can act as whom).
