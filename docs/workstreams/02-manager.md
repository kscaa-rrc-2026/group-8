# Workstream 2 — Manager

Branch: `feature/manager`
API folder: `apps/api/src/modules/manager`
Web folder: `apps/web/src/modules/manager`

## Scope

Approval Queue, Claim Review, Approve / Reject / Return with mandatory
remarks — the first checker in the maker-checker flow.

## Data owned

Writes `ApprovalStep` (role `MANAGER`) and transitions `Claim.status`
between `SUBMITTED` → `MANAGER_APPROVED` / `MANAGER_REJECTED` /
`MANAGER_RETURNED`. Does not own claim creation (employee) or
verification/payment (accounts).

## What's already built

- API: `GET /api/manager/approvals`, `GET /api/manager/approvals/:id`,
  `POST /api/manager/approvals/:id/decision` (remarks required,
  transactional status + `ApprovalStep` write, audit-logged).
- Web: Approval Queue list, Claim Review detail with
  Approve/Return/Reject buttons.

## What's left

1. Multi-level approval: `listPendingApprovals` currently only handles a
   single manager step. Wire it to `ApprovalMatrix` (owned by workstream
   4 — coordinate on the read pattern) so claims above a department's
   threshold escalate to a second approver instead of skipping straight to
   Accounts.
2. Notify the employee (`Notification` row) on every decision — TODO
   already marked in `service.ts`.
3. Attachment preview/download in Claim Review once real file storage
   exists (workstream 1 dependency).

## Definition of done

- A manager sees only claims for their department awaiting review, cannot
  submit a decision without remarks, and the claim's status/audit trail
  update correctly for all three decision types.
