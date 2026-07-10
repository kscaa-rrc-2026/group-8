import { Fragment, useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeData: unknown;
  afterData: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

const ENTITY_TYPES = ["Claim", "Employee", "Payment", "Department", "ApprovalMatrix"];

export function AuditLog() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [filters, setFilters] = useState({ entityType: "", action: "", from: "", to: "" });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (filters.entityType) params.entityType = filters.entityType;
    if (filters.action) params.action = filters.action;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    api.get("/admin/audit-log", { params }).then((res) => {
      setLogs(res.data.data.logs);
      setTotal(res.data.data.total);
    });
  }

  useEffect(load, [page, filters]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Audit Log</h1>
      <p className="text-sm text-slate-500 mb-4">
        Every create/update/delete in the system is recorded here automatically and cannot be edited or removed — this is the immutable trail, not a report.
      </p>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Entity type</label>
          <select
            value={filters.entityType}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, entityType: e.target.value });
            }}
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Action contains</label>
          <input
            value={filters.action}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, action: e.target.value });
            }}
            placeholder="e.g. CLAIM_APPROVE"
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, from: e.target.value });
            }}
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setPage(1);
              setFilters({ ...filters, to: e.target.value });
            }}
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Entity</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No matching audit log entries.
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <Fragment key={log.id}>
                <tr className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2">{log.user ? `${log.user.name} (${log.user.role})` : "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {log.entityType} <span className="text-xs">#{log.entityId.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setExpandedId(expandedId === log.id ? null : log.id)} className="btn-secondary text-xs">
                      {expandedId === log.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <div className="font-medium text-slate-500 mb-1">Before</div>
                          <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto">{JSON.stringify(log.beforeData, null, 2) ?? "—"}</pre>
                        </div>
                        <div>
                          <div className="font-medium text-slate-500 mb-1">After</div>
                          <pre className="bg-white border border-slate-200 rounded p-2 overflow-x-auto">{JSON.stringify(log.afterData, null, 2) ?? "—"}</pre>
                        </div>
                      </div>
                      {log.ipAddress && <div className="text-xs text-slate-400 mt-2">IP: {log.ipAddress}</div>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>
          {total} entries — page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs">
            Previous
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
