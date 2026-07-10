import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Claim {
  status: string;
  totalAmount: string;
}

// TODO: replace this client-side aggregation with a real
// GET /api/employee/dashboard summary endpoint once it exists (see
// apps/api/src/modules/employee/CLAUDE.md) — fine for now at small volume.
export function Dashboard() {
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    api.get("/employee/claims").then((res) => setClaims(res.data.data));
  }, []);

  const pending = claims.filter((c) => c.status === "SUBMITTED" || c.status === "MANAGER_APPROVED").length;
  const paid = claims.filter((c) => c.status === "PAID").length;
  const rejected = claims.filter((c) => c.status === "MANAGER_REJECTED" || c.status === "ACCOUNTS_REJECTED").length;
  const pendingAmount = claims
    .filter((c) => c.status === "SUBMITTED" || c.status === "MANAGER_APPROVED")
    .reduce((sum, c) => sum + Number(c.totalAmount), 0);

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total claims" value={claims.length} />
        <StatCard label="Pending" value={pending} />
        <StatCard label="Paid" value={paid} />
        <StatCard label="Rejected" value={rejected} />
      </div>
      <div className="card p-4 mt-4">
        <div className="text-sm text-slate-500">Pending reimbursement amount</div>
        <div className="text-2xl font-semibold text-brand-900">₹{pendingAmount.toLocaleString()}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-brand-900">{value}</div>
    </div>
  );
}
