# Design system

Applies to all 5 role dashboards (Employee, Manager, Accounts, Admin,
Reports). Goal: one consistent, professional look — don't invent new
colors/fonts inside a single module.

Tokens live in [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts).

## Color

- **Brand (`brand-*`)** — slate-blue scale, `brand-700` (`#334e68`) is the
  primary action/header color, `brand-900` (`#102a43`) for the sidebar.
  Neutral grays (Tailwind's default `slate-*`) for body text and borders.
- **Status (`status-*`)** — one color per `ClaimStatus` family, always paired
  with a light background via the `.badge-*` classes in `src/index.css`:
  - `pending` (amber) — `SUBMITTED`, `MANAGER_APPROVED` (awaiting next step)
  - `approved` (emerald) — `ACCOUNTS_VERIFIED`
  - `rejected` (red) — `MANAGER_REJECTED`, `ACCOUNTS_REJECTED`
  - `returned` (orange) — `MANAGER_RETURNED`
  - `paid` (blue) — `PAID`

  Never use raw hex or a different red/green elsewhere for status — always
  go through these classes so a claim's state reads the same on every
  dashboard.

## Typography

- Font: **Inter** (loaded in `index.html`), fallback `system-ui`.
- Don't drop to a second typeface for "emphasis" — use weight (`font-medium`
  / `font-semibold`) and size, not a different font family.

## Components

- `.btn-primary` / `.btn-secondary` — the only two button styles. Primary
  for the main action on a screen (Submit Claim, Approve, Process Payment),
  secondary for everything else.
- `.card` — the standard container for a list/detail panel.
- Shared layout (`Sidebar`, `Topbar`) lives in
  `apps/web/src/components/layout` — reuse it, don't build a per-module
  nav.

## Adding something new

If your module needs a color, spacing value, or component that doesn't
exist yet: add it to `tailwind.config.ts` / `src/index.css` and note it
here, don't hardcode it in your module's JSX.
