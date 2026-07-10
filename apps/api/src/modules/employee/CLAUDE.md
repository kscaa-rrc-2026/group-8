# API — Employee module

Owns: Dashboard data, New Claim, Upload Bills, Claim History, Notifications.
Full spec: [docs/workstreams/01-employee.md](../../../../../docs/workstreams/01-employee.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md))

`service.ts` has the create-claim flow fully implemented — it's the
reference pattern for the rest of the app: validate ownership → write →
`recordAuditLog`. Copy that shape for any new mutation.

Still open in this module:
- Dashboard summary endpoint (counts by status, pending amount) — add a
  `GET /api/employee/dashboard` route + service function.
- Real object storage for attachments (currently a `local://` placeholder
  URL) — swap in whatever the team picks (S3-compatible, disk, etc.).
- Enforce "at least one attachment required" before a claim can move out of
  DRAFT, per the problem statement's mandatory-bill-attachment rule.

Don't implement manager/accounts approval logic here — that's
`../manager` and `../accounts`. This module only ever touches claims where
`employeeId === req.user.id`.
