# Web — Admin module

Owns: Employee & Department Master, Approval Matrix, Roles, User Management.
Full spec: [docs/workstreams/04-admin.md](../../../../../docs/workstreams/04-admin.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

`Employees.tsx`, `Departments.tsx`, `ApprovalMatrix.tsx` are all wired to
their matching API routes with list + create working end to end.
`ApprovalMatrix.tsx` also supports inline edit/delete per rule
(`PATCH`/`DELETE /api/admin/approval-matrix/:id`).

Still open in this module:
- No employee edit form — only create and deactivate. Add one once
  `apps/api/src/modules/admin` has a `PATCH /employees/:id` route.
- No client-side check for overlapping Approval Matrix ranges (matches the
  API-side TODO — edit/delete themselves are done).
- "Roles" is just the role dropdown in `Employees.tsx` today — see
  `apps/api/src/modules/admin/CLAUDE.md` before building a separate
  permissions UI.
