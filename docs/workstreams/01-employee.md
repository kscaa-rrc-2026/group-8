# Workstream 1 — Employee

Branch: `feature/employee`
API folder: `apps/api/src/modules/employee`
Web folder: `apps/web/src/modules/employee`

## Scope

Dashboard, New Claim, Upload Bills, Claim History, Notifications — the
employee-facing side of the claim lifecycle from draft through payment
(read-only once submitted).

## Data owned

Reads/writes `Claim`, `ClaimLineItem`, `Attachment` (only rows where
`employeeId === req.user.id`), reads `Notification` for self. Does not
own `ExpenseCategory` (admin) or approval/payment data (manager/accounts).

## What's already built

- API: `GET/POST /api/employee/claims`, `GET /api/employee/claims/:id`,
  `POST /api/employee/claims/:id/attachments`,
  `GET /api/employee/notifications`, `PATCH .../notifications/:id/read`.
- Web: Dashboard, New Claim (with attachment upload), Claim History,
  Notifications — all wired to the above.

## What's left (see module CLAUDE.md files for detail)

1. Real dashboard summary endpoint (currently client-aggregated).
2. Category picker sourced from `ExpenseCategory` once Admin exposes it —
   coordinate with workstream 4.
3. Notification creation on manager/accounts decisions is a TODO in
   workstreams 2 & 3 — nothing to build here, but test against it once
   those land.
4. Real object storage for attachments (currently a placeholder URL).

## Definition of done

- An employee can log in, submit a claim with at least one line item and
  one bill attachment, see it in history with the correct status badge,
  and see notifications update as it moves through approval.
