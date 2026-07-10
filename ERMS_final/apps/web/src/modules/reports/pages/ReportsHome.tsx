import { useState } from "react";
import { api } from "../../../lib/api";
import { downloadFile } from "../../../lib/download";

const REPORTS = [
  { key: "employee-wise", label: "Employee-wise" },
  { key: "department-wise", label: "Department-wise" },
  { key: "monthly", label: "Monthly" },
  { key: "payments", label: "Payment" },
  { key: "rejected", label: "Rejected" },
] as const;

// TODO: only CSV export is implemented (apps/api/src/modules/reports/service.ts
// `toCsv`). Excel/PDF buttons are wired to the same endpoint with a
// format that isn't handled server-side yet — see that module's CLAUDE.md.
export function ReportsHome() {
  const [active, setActive] = useState<(typeof REPORTS)[number]["key"]>("employee-wise");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [month, setMonth] = useState("2026-07");

  async function load() {
    const params = active === "monthly" ? { month } : {};
    const { data } = await api.get(`/reports/${active}`, { params });
    setRows(data.data);
  }

  async function downloadCsv() {
    const params: Record<string, string> = { format: "csv" };
    if (active === "monthly") params.month = month;
    await downloadFile(`/reports/${active}`, `${active}-report.csv`, params);
  }

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Reports</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={active === r.key ? "btn-primary" : "btn-secondary"}
          >
            {r.label}
          </button>
        ))}
      </div>

      {active === "monthly" && (
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
        />
      )}

      <div className="flex gap-2 mb-4">
        <button className="btn-secondary" onClick={load}>
          Run report
        </button>
        <button className="btn-secondary" onClick={downloadCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2 font-medium whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap">
                      {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
