# Workstream 5 — Reports

Branch: `feature/reports`
API folder: `apps/api/src/modules/reports`
Web folder: `apps/web/src/modules/reports`

## Scope

Employee-wise, Department-wise, Monthly, Payment, Rejected reports, each
exportable as Excel / PDF / CSV.

## Data owned

Read-only — aggregates `Claim`, `Payment`, `Employee`, `Department`. No
writes, so no audit log requirement (viewing a report isn't a mutation).

## What's already built

- API: all 5 report queries (`GET /api/reports/employee-wise`,
  `/department-wise`, `/monthly?month=YYYY-MM`, `/payments`, `/rejected`),
  plus CSV export via `?format=csv`.
- Web: single generic `ReportsHome.tsx` — pick a report, run it, view as a
  table, export CSV.

## What's left — priority order

1. **Fix the CSV download** — `ReportsHome.tsx`'s `downloadCsv()` uses
   `window.open`, which drops the auth header the API requires and will
   401. Switch to an authenticated blob download (see that component's
   CLAUDE.md for the exact fix).
2. Excel export — add `exceljs`, implement `toExcel(rows)` in
   `apps/api/src/modules/reports/service.ts` mirroring `toCsv`, wire
   `format=xlsx` through `routes.ts`'s `respond()` helper.
3. PDF export — same shape with `pdfkit`, `format=pdf`.
4. Access: currently gated to `ACCOUNTS`/`ADMIN` per the role list in the
   problem statement. Confirm with the team whether Managers should see a
   department-scoped view of department-wise reports.

## Definition of done

- All 5 reports return correct data against seeded/real claims, and CSV
  export downloads a valid file from the browser (not just via curl).
