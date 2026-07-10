# API — Manager module

Owns: Approval Queue, Claim Review, Approve / Reject / Return with remarks.
Full spec: [docs/workstreams/02-manager.md](../../../../../docs/workstreams/02-manager.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md))

`service.ts` has approve/reject/return fully implemented, including the
maker-checker write (`Claim` status update + `ApprovalStep` row in one
transaction) and the mandatory-remarks check. Use this as the pattern for
Accounts' verify/reject flow too — they're structurally the same operation.

Still open in this module:
- `listPendingApprovals` only handles a single-level (manager-only) chain.
  Wire it to `ApprovalMatrix` so claims above a department's threshold
  route to a second approver instead of going straight to Accounts.
- Notify the employee (create a `Notification` row) on every decision —
  see the TODO in `service.ts`.
- Claim Review screen needs the full attachment list rendered — attachments
  are already included in `getClaimForReview`, just needs a frontend page.

Don't change `ClaimStatus` transitions without checking with the Accounts
and Employee workstreams — they both branch on these status values.
