# Web — Reports module

Owns: Employee-wise, Department-wise, Monthly, Payment, Rejected reports
with Excel / PDF / CSV export.
Full spec: [docs/workstreams/05-reports.md](../../../../../docs/workstreams/05-reports.md)
(root project conventions: [CLAUDE.md](../../../../../CLAUDE.md), design tokens:
[docs/design-system.md](../../../../../docs/design-system.md))

`ReportsHome.tsx` runs all 5 report queries and renders a generic table
from whatever columns come back — no per-report page needed unless a
report needs custom formatting.

`downloadCsv()` uses the shared `downloadFile()` helper
(`apps/web/src/lib/download.ts`) — fetches as an authenticated blob and
triggers the save from an object URL, since a plain `<a href>`/`window.open`
can't carry the Authorization header the API requires. Reuse that helper
for any other file download instead of reimplementing this per module (the
manager module's Approval Queue/Summary CSV exports already do).

Still open:
- Excel/PDF export buttons don't exist yet — add once
  `apps/api/src/modules/reports/service.ts` has `toExcel`/`toPdf` (see that
  module's CLAUDE.md), then add `format=xlsx`/`format=pdf` alongside the
  existing `format=csv` handling here.
- Table rendering is generic/unstyled for nested objects (e.g. `employee`)
  — fine for a raw data dump, revisit if reports need to look
  presentation-ready in-app rather than just in the exported file.
