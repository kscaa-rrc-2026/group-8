# Web — Reports module

Owns: Employee-wise, Department-wise, Monthly, Payment, Rejected reports
with Excel / PDF / CSV export.
Full spec: [docs/workstreams/05-reports.md](../../../../../docs/workstreams/05-reports.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

`ReportsHome.tsx` runs all 5 report queries and renders a generic table
from whatever columns come back — no per-report page needed unless a
report needs custom formatting.

**Known gap, fix before relying on it:** `downloadCsv()` uses
`window.open`, which does **not** send the `Authorization` bearer header
`api.ts`'s interceptor adds — the request will 401. Replace it with
`api.get(..., { responseType: "blob" })` + a manually created object URL
(`URL.createObjectURL`) and a synthetic `<a download>` click, same as any
authenticated file download.

Still open:
- Excel/PDF export buttons don't exist yet — add once
  `apps/api/src/modules/reports/service.ts` has `toExcel`/`toPdf` (see that
  module's CLAUDE.md), then add `format=xlsx`/`format=pdf` alongside the
  existing `format=csv` handling here.
- Table rendering is generic/unstyled for nested objects (e.g. `employee`)
  — fine for a raw data dump, revisit if reports need to look
  presentation-ready in-app rather than just in the exported file.
