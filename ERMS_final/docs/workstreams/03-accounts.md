# Workstream 3 — Accounts

Branch: `feature/accounts`
API folder: `apps/api/src/modules/accounts`
Web folder: `apps/web/src/modules/accounts`

## Scope

Verification, Duplicate Detection, Payment Processing — the second
checker, and the only workstream that touches money movement.

## Data owned

Writes `ApprovalStep` (role `ACCOUNTS`), transitions `Claim.status`
between `MANAGER_APPROVED` → `ACCOUNTS_VERIFIED` / `ACCOUNTS_REJECTED` →
`PAID`. Owns `Payment` (create only, one per claim). Reads/flags
`Claim.isDuplicateFlagged`.

## What's already built

- API: `GET /api/accounts/verification`,
  `GET /api/accounts/verification/:id/duplicates`,
  `POST /api/accounts/verification/:id/decision`,
  `GET /api/accounts/payments` (every `ACCOUNTS_VERIFIED` claim — "pending
  payable", compulsory until paid), `POST /api/accounts/payments/:claimId`.
- Web: Verification screen (list + on-demand duplicate check +
  verify/reject with remarks); Payment Processing screen listing pending
  payable claims.

## What's left — priority order

1. Auto-run `detectDuplicates` when a claim enters `MANAGER_APPROVED`
   instead of requiring a manual click.
2. Notify the employee on verify/reject/payment.
3. Batch payment support; a failed/retry state for `Payment`.

## Definition of done

- Accounts can see manager-approved claims, run duplicate detection before
  verifying, and only claims in `ACCOUNTS_VERIFIED` can be marked paid —
  attempting to pay anything else returns a 409 (already enforced
  server-side, don't regress it).
