import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../lib/api";
import { StatusBadge, type ClaimStatus } from "../../../components/StatusBadge";

interface ClaimDetail {
  id: string;
  claimNumber: string;
  totalAmount: string;
  status: ClaimStatus;
  employee: { name: string; email: string };
  lineItems: { id: string; expenseDate: string; amount: string; description: string | null }[];
  attachments: { id: string; fileName: string; fileUrl: string }[];
}

type Decision = "APPROVE" | "REJECT" | "RETURN";

export function ClaimReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/manager/approvals/${id}`).then((res) => setClaim(res.data.data));
  }, [id]);

  async function decide(decision: Decision) {
    setError(null);
    if (!remarks.trim()) {
      setError("Remarks are required for every decision.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/manager/approvals/${id}/decision`, { decision, remarks });
      navigate("/manager/approvals");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to record decision");
    } finally {
      setSubmitting(false);
    }
  }

  if (!claim) return <div className="text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold text-slate-900">{claim.claimNumber}</h1>
        <StatusBadge status={claim.status} />
      </div>

      <div className="card p-6 mb-4">
        <div className="text-sm text-slate-500 mb-3">
          {claim.employee.name} · {claim.employee.email}
        </div>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="font-medium py-1">Date</th>
              <th className="font-medium py-1">Description</th>
              <th className="font-medium py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {claim.lineItems.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="py-1">{new Date(item.expenseDate).toLocaleDateString()}</td>
                <td className="py-1">{item.description ?? "—"}</td>
                <td className="py-1">₹{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="font-semibold text-brand-900">Total: ₹{claim.totalAmount}</div>

        <div className="mt-4">
          <div className="text-sm font-medium text-slate-700 mb-1">Attachments</div>
          {claim.attachments.length === 0 && <div className="text-sm text-slate-400">No attachments.</div>}
          <ul className="text-sm list-disc list-inside text-brand-700">
            {claim.attachments.map((a) => (
              <li key={a.id}>{a.fileName}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card p-6">
        {error && <div className="badge-rejected mb-3 block w-fit">{error}</div>}
        <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (required)</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
          rows={3}
        />
        <div className="flex gap-3">
          <button disabled={submitting} onClick={() => decide("APPROVE")} className="btn-primary">
            Approve
          </button>
          <button disabled={submitting} onClick={() => decide("RETURN")} className="btn-secondary">
            Return
          </button>
          <button disabled={submitting} onClick={() => decide("REJECT")} className="btn-secondary text-status-rejected">
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
