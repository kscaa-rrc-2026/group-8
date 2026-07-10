# Workstream 4 — Admin

Branch: `feature/admin`
API folder: `apps/api/src/modules/admin`
Web folder: `apps/web/src/modules/admin`

## Scope

Employee & Department Master, Approval Matrix, Roles, User Management —
the master-data and access-control backbone every other workstream reads
from.

## Data owned

`Employee` (create/deactivate — the only workstream that writes this
outside of self-service like MFA enrollment), `Department`,
`ApprovalMatrix`, `ExpenseCategory` (not yet exposed via API — see below).

## What's already built

- API: employee create/deactivate (with audit log + password hashing),
  department create/list, approval matrix create/list.
- Web: Employees (list + create + deactivate), Departments (list +
  create), Approval Matrix (list + create).

## What's left — priority order

1. **`ExpenseCategory` CRUD** — the Employee workstream's New Claim form
   needs a real category list (`docs/workstreams/01-employee.md` /
   `apps/web/src/modules/employee/CLAUDE.md` both flag this). Currently no
   endpoint exists at all — add `GET/POST /api/admin/categories`.
2. Employee update (name/department/manager/role) — only create and
   deactivate exist.
3. Approval Matrix: reject overlapping min/max ranges for the same
   department + sequence.
4. Password reset + MFA enrollment (`otplib` already in
   `apps/api/package.json`) for User Management.

## Coordination note

Workstream 1 (Employee) is blocked on your `ExpenseCategory` endpoint for
a proper category picker — flag them once it's up so they can swap the
placeholder text input.

## Definition of done

- An admin can create a department, create an employee assigned to it with
  a role, define an approval matrix rule, and deactivate an employee —
  every one of those actions has a corresponding `AuditLog` row.
