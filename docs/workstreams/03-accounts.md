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
  `POST /api/accounts/payments/:claimId`.
- Web: Verification screen (list + on-demand duplicate check +
  verify/reject with remarks).

## What's left — priority order

1. **`GET /api/accounts/payments` (list endpoint)** — nothing currently
   lists `ACCOUNTS_VERIFIED` claims for the Payment Processing screen; the
   web page is a documented stub pointing at the wrong list. This blocks a
   working Payment Processing screen, do it first.
2. Auto-run `detectDuplicates` when a claim enters `MANAGER_APPROVED`
   instead of requiring a manual click.
3. Notify the employee on verify/reject/payment.
4. Batch payment support; a failed/retry state for `Payment`.

## Definition of done

- Accounts can see manager-approved claims, run duplicate detection before
  verifying, and only claims in `ACCOUNTS_VERIFIED` can be marked paid —
  attempting to pay anything else returns a 409 (already enforced
  server-side, don't regress it).
