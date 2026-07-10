import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { StatusBadge, type ClaimStatus } from "../../../components/StatusBadge";

interface Claim {
  id: string;
  claimNumber: string;
  totalAmount: string;
  status: ClaimStatus;
  isDuplicateFlagged: boolean;
  employee: { name: string };
}

interface DuplicateResult {
  isDuplicate: boolean;
  matchingClaims: { id: string; claimNumber: string }[];
}

export function Verification() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateResult>>({});
  const [remarksByClaim, setRemarksByClaim] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/accounts/verification").then((res) => setClaims(res.data.data));
  }, []);

  async function checkDuplicate(claimId: string) {
    const { data } = await api.get(`/accounts/verification/${claimId}/duplicates`);
    setDuplicates((prev) => ({ ...prev, [claimId]: data.data }));
  }

  async function decide(claimId: string, decision: "VERIFY" | "REJECT") {
    setError(null);
    const remarks = remarksByClaim[claimId] ?? "";
    if (!remarks.trim()) {
      setError("Remarks are required.");
      return;
    }
    try {
      await api.post(`/accounts/verification/${claimId}/decision`, { decision, remarks });
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to record decision");
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Verification</h1>
      {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

      <div className="space-y-4">
        {claims.length === 0 && <div className="text-sm text-slate-400">Nothing pending verification.</div>}
        {claims.map((claim) => {
          const dup = duplicates[claim.id];
          return (
            <div key={claim.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">
                  {claim.claimNumber} · {claim.employee.name} · ₹{claim.totalAmount}
                </div>
                <StatusBadge status={claim.status} />
              </div>

              {!dup && (
                <button className="btn-secondary text-xs mb-2" onClick={() => checkDuplicate(claim.id)}>
                  Run duplicate check
                </button>
              )}
              {dup?.isDuplicate && (
                <div className="badge-rejected mb-2 block w-fit">
                  Possible duplicate of: {dup.matchingClaims.map((m) => m.claimNumber).join(", ") || "matching attachment hash"}
                </div>
              )}
              {dup && !dup.isDuplicate && <div className="badge-approved mb-2 block w-fit">No duplicates found</div>}

              <textarea
                placeholder="Remarks (required)"
                value={remarksByClaim[claim.id] ?? ""}
                onChange={(e) => setRemarksByClaim((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2"
                rows={2}
              />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={() => decide(claim.id, "VERIFY")}>
                  Verify
                </button>
                <button className="btn-secondary text-status-rejected" onClick={() => decide(claim.id, "REJECT")}>
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
