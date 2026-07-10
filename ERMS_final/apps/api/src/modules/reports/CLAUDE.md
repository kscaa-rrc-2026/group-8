# API — Reports module

Owns: Employee-wise, Department-wise, Monthly, Payment, Rejected reports,
each exportable as Excel / PDF / CSV.
Full spec: [docs/workstreams/05-reports.md](../../../../../docs/workstreams/05-reports.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md))

`service.ts` has all 5 report queries implemented plus a dependency-free
CSV export (`toCsv`). `routes.ts`'s `respond()` helper is the pattern to
extend for the other formats — same "rows in, format out" shape.

Still open in this module:
- Excel export: add `exceljs` to `apps/api/package.json`, implement
  `toExcel(rows)` in `service.ts` returning a `Buffer`, wire it into
  `respond()` under `format === "xlsx"`.
- PDF export: add `pdfkit`, implement `toPdf(rows)` similarly under
  `format === "pdf"`.
- Reports currently gated to `ACCOUNTS`/`ADMIN` per the role list in the
  problem statement — check with the team if Managers should see
  department-wise reports for their own department only.
- Pagination/date-range filtering on the monthly/payment reports once real
  data volume shows up.

These are read-only aggregation queries — no audit log needed here (viewing
a report isn't a mutation), but don't let a report route ever accept a
write.
