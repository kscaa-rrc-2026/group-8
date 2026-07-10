# Web — Accounts module

Owns: Verification, Duplicate Detection, Payment Processing.
Full spec: [docs/workstreams/03-accounts.md](../../../../../docs/workstreams/03-accounts.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

`Verification.tsx` is fully wired: lists `MANAGER_APPROVED` claims, runs
on-demand duplicate detection (`GET .../duplicates`), verify/reject with
required remarks — same pattern as the manager's `ClaimReview.tsx`.

`PaymentProcessing.tsx` lists every `ACCOUNTS_VERIFIED` claim ("pending
payable") via `GET /api/accounts/payments` — a claim only disappears from
this list once it's actually marked paid, so an approved claim can't be
silently left unpaid.

Still open:
- Auto-run duplicate detection when a claim enters the queue instead of
  requiring a manual click (matches the API-side TODO in
  `apps/api/src/modules/accounts/CLAUDE.md`).
- Batch payment processing.
