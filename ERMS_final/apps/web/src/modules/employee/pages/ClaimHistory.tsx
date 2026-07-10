import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../lib/api";
import { StatusBadge, type ClaimStatus } from "../../../components/StatusBadge";

interface Claim {
  id: string;
  claimNumber: string;
  totalAmount: string;
  status: ClaimStatus;
  createdAt: string;
}

export function ClaimHistory() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api
      .get("/employee/claims")
      .then((res) => setClaims(res.data.data))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function resubmit(claimId: string) {
    setError(null);
    try {
      await api.post(`/employee/claims/${claimId}/resubmit`);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to resubmit claim");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-slate-900">Claim History</h1>
        <Link to="/employee/claims/new" className="btn-primary">
          New Claim
        </Link>
      </div>

      {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Claim #</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Submitted</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && claims.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No claims yet.
                </td>
              </tr>
            )}
            {claims.map((claim) => (
              <tr key={claim.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">{claim.claimNumber}</td>
                <td className="px-4 py-2">₹{claim.totalAmount}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={claim.status} />
                </td>
                <td className="px-4 py-2 text-slate-500">{new Date(claim.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right">
                  {claim.status === "MANAGER_RETURNED" && (
                    <button onClick={() => resubmit(claim.id)} className="btn-secondary text-xs">
                      Resubmit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
