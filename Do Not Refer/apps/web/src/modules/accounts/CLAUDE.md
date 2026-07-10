# Web — Accounts module

Owns: Verification, Duplicate Detection, Payment Processing.
Full spec: [docs/workstreams/03-accounts.md](../../../../../docs/workstreams/03-accounts.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

`Verification.tsx` is fully wired: lists `MANAGER_APPROVED` claims, runs
on-demand duplicate detection (`GET .../duplicates`), verify/reject with
required remarks — same pattern as the manager's `ClaimReview.tsx`.

`PaymentProcessing.tsx` is a **stub, not a finished screen** — it currently
reads from `/accounts/verification` (wrong list: that returns
`MANAGER_APPROVED` claims, but payment only works on `ACCOUNTS_VERIFIED`
ones) as a placeholder. Before this is usable:
1. Add `GET /api/accounts/payments` to `apps/api/src/modules/accounts` that
   lists `ACCOUNTS_VERIFIED` claims (see the CLAUDE.md in that API folder).
2. Point this page at it instead.

Still open:
- Auto-run duplicate detection when a claim enters the queue instead of
  requiring a manual click (matches the API-side TODO in
  `apps/api/src/modules/accounts/CLAUDE.md`).
- Batch payment processing.
