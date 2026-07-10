# API — Accounts module

Owns: Verification, Duplicate Detection, Payment Processing.
Full spec: [docs/workstreams/03-accounts.md](../../../../../docs/workstreams/03-accounts.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md))

`service.ts` has all three flows implemented as a working baseline:
- `detectDuplicates` — deterministic check (attachment file hash reuse +
  same employee/amount within a 7-day window). This is intentionally simple;
  the AI roadmap item (ML-based fraud scoring) augments this later, it
  doesn't replace the deterministic check as the compliance baseline.
- `decideVerification` — verify/reject, mirrors the manager approve/reject
  pattern in `../manager/service.ts`.
- `processPayment` — only allowed from `ACCOUNTS_VERIFIED`, writes `Payment`
  + flips `Claim.status` to `PAID` in one transaction.

Still open in this module:
- Call `detectDuplicates` automatically when a claim enters
  `MANAGER_APPROVED` (not just on-demand from the UI) and surface the flag
  prominently before verification can proceed.
- Payment Processing screen: batch payment support, and a way to mark a
  payment as failed/retry (currently one-shot).
- Notify the employee on verification/rejection/payment — same
  `Notification` TODO pattern as the manager module.

Never call `processPayment` from anywhere except a route gated by
`requireRole("ACCOUNTS", "ADMIN")` — payment is the highest-risk mutation
in the system.
