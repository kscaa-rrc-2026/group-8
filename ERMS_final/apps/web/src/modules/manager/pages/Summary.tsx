import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { downloadFile } from "../../../lib/download";
import { StatusBadge, type ClaimStatus } from "../../../components/StatusBadge";

type Decision = "APPROVE" | "REJECT" | "RETURN";

interface SummaryClaim {
  id: string;
  claimNumber: string;
  employeeName: string;
  totalAmount: string;
  approvedAmount: string | null;
  decision: Decision;
  currentStatus: ClaimStatus;
  remarks: string;
  actedAt: string;
}

interface Summary {
  approvedCount: number;
  returnedCount: number;
  rejectedCount: number;
  claims: SummaryClaim[];
}

const DECISION_LABEL: Record<Decision, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  RETURN: "Returned",
};

const DECISION_BADGE: Record<Decision, string> = {
  APPROVE: "badge-approved",
  REJECT: "badge-rejected",
  RETURN: "badge-returned",
};

export function Summary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<Decision | "ALL">("ALL");

  useEffect(() => {
    api.get("/manager/summary").then((res) => setSummary(res.data.data));
  }, []);

  if (!summary) return <div className="text-slate-400 text-sm">Loading…</div>;

  const visibleClaims = filter === "ALL" ? summary.claims : summary.claims.filter((c) => c.decision === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-slate-900">Approval Summary</h1>
        <button
          className="btn-secondary"
          disabled={summary.claims.length === 0}
          onClick={() => downloadFile("/manager/summary", "approval-summary.csv", { format: "csv" })}
        >
          Export CSV
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-4">Every decision you've made — "current status" reflects what's happened to the claim since.</p>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl">
        <button className="card p-4 text-left" onClick={() => setFilter(filter === "APPROVE" ? "ALL" : "APPROVE")}>
          <div className="text-sm text-slate-500">Approved</div>
          <div className="text-2xl font-semibold text-status-approved">{summary.approvedCount}</div>
        </button>
        <button className="card p-4 text-left" onClick={() => setFilter(filter === "RETURN" ? "ALL" : "RETURN")}>
          <div className="text-sm text-slate-500">Returned</div>
          <div className="text-2xl font-semibold text-status-returned">{summary.returnedCount}</div>
        </button>
        <button className="card p-4 text-left" onClick={() => setFilter(filter === "REJECT" ? "ALL" : "REJECT")}>
          <div className="text-sm text-slate-500">Rejected</div>
          <div className="text-2xl font-semibold text-status-rejected">{summary.rejectedCount}</div>
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Claim #</th>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Your decision</th>
              <th className="px-4 py-2 font-medium">Current status</th>
              <th className="px-4 py-2 font-medium">Remarks</th>
              <th className="px-4 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {visibleClaims.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No claims here yet.
                </td>
              </tr>
            )}
            {visibleClaims.map((claim) => (
              <tr key={claim.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">{claim.claimNumber}</td>
                <td className="px-4 py-2">{claim.employeeName}</td>
                <td className="px-4 py-2">
                  ₹{claim.totalAmount}
                  {claim.decision === "APPROVE" && claim.approvedAmount !== null && Number(claim.approvedAmount) < Number(claim.totalAmount) && (
                    <div className="text-xs text-amber-600">Approved: ₹{claim.approvedAmount}</div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <span className={DECISION_BADGE[claim.decision]}>{DECISION_LABEL[claim.decision]}</span>
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={claim.currentStatus} />
                </td>
                <td className="px-4 py-2 text-slate-600">{claim.remarks || "—"}</td>
                <td className="px-4 py-2 text-slate-500">{new Date(claim.actedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
