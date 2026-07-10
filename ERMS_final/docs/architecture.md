# Architecture

## Overview

```
apps/web (React) ──HTTP/JWT──> apps/api (Express) ──Prisma──> PostgreSQL
                                     │
                                     └─ packages/db (schema, single source of truth)
```

Each of the 4 roles (Employee, Manager, Accounts, Admin) is a JWT-bearing
session for an `Employee` row with a `Role`. There's no separate "user"
table — every login is an `Employee`.

## Claim lifecycle

```
DRAFT → SUBMITTED → MANAGER_APPROVED → ACCOUNTS_VERIFIED → PAID
                  ↘ MANAGER_REJECTED
                  ↘ MANAGER_RETURNED (back to employee, resubmit as SUBMITTED)
                                    ↘ ACCOUNTS_REJECTED
```

Each transition writes one `ApprovalStep` row (maker-checker: the employee
makes the claim, the manager/accounts checker approves or rejects it) and
one `AuditLog` row. See `packages/db/prisma/schema.prisma` for the full
model and `ClaimStatus`/`ApprovalActionType` enums.

## Security & internal controls

- **RBAC**: enforced server-side in every module's routes via
  `requireRole()` (`apps/api/src/middleware/rbac.ts`). The frontend hiding
  a nav item is a UX nicety, never the actual gate.
- **Maker-checker**: an employee can never approve their own claim — routes
  are role-gated so `EMPLOYEE` never has access to the approval/verification
  endpoints regardless of what claim they pass in.
- **Audit trail**: `AuditLog` is append-only. Every mutation goes through
  `recordAuditLog()` (`apps/api/src/middleware/auditLog.ts`).
- **Soft delete**: `deletedAt` on Employee/Department/Claim — no hard
  deletes, ever.
- **Session timeout**: JWT carries a `lastActiveAt` claim; `requireAuth`
  rejects a technically-valid token once it's idle past
  `SESSION_IDLE_TIMEOUT_MIN`.
- **MFA**: TOTP via `otplib`, `Employee.mfaSecret`/`mfaEnabled` — the
  schema has the fields, but the enrollment flow is not yet built.
- **Mandatory bill attachments + remarks**: enforced both client-side (form
  validation) and server-side (`ApiError` thrown if missing) — see
  `apps/api/src/modules/employee/routes.ts` and
  `apps/api/src/modules/manager/service.ts`.
- **Duplicate detection**: `apps/api/src/modules/accounts/service.ts`
  `detectDuplicates` — file-hash reuse + same employee/amount within a
  7-day window, run before a claim can be marked `ACCOUNTS_VERIFIED`.

## AI roadmap (not yet built)

- OCR-based bill/receipt data extraction — would sit in front of
  `POST /api/employee/claims/:id/attachments`, pre-filling line items.
- AI-based duplicate/fraud detection — augments (doesn't replace) the
  deterministic check in the accounts module.

Neither is scaffolded yet.
