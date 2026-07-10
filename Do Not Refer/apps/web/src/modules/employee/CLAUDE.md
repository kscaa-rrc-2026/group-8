# Web — Employee module

Owns: Dashboard, New Claim, Upload Bills, Claim History, Notifications.
Full spec: [docs/workstreams/01-employee.md](../../../../../docs/workstreams/01-employee.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

All 4 pages are implemented against the matching API routes in
`apps/api/src/modules/employee`. `NewClaim.tsx` combines line items + bill
upload into one flow (Upload Bills isn't a separate screen — it's the
attachment step of submitting a claim).

Still open in this module:
- `Dashboard.tsx` aggregates client-side — swap for a real
  `GET /api/employee/dashboard` once that endpoint exists.
- `NewClaim.tsx`'s category field is a raw `categoryId` text input — replace
  with a `<select>` once there's an endpoint to list `ExpenseCategory` rows
  (that's admin-owned data).
- Claim status labels/colors are centralized in
  `src/components/StatusBadge.tsx` — if you add a new status meaning,
  update it there, not locally.

Use `useAuth()` (`src/lib/auth.tsx`) for the current user, `api`
(`src/lib/api.ts`) for all HTTP calls — don't create a second axios
instance or auth mechanism in this module.
