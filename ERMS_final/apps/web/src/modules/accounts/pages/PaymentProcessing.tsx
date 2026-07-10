import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { StatusBadge, type ClaimStatus } from "../../../components/StatusBadge";

interface Claim {
  id: string;
  claimNumber: string;
  totalAmount: string;
  status: ClaimStatus;
  employee: { name: string };
}

const PAYMENT_MODES = ["BANK_TRANSFER", "CHEQUE", "CASH"] as const;

export function PaymentProcessing() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [modeByClaim, setModeByClaim] = useState<Record<string, (typeof PAYMENT_MODES)[number]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/accounts/payments").then((res) => setClaims(res.data.data));
  }, []);

  async function processPayment(claimId: string) {
    setError(null);
    const paymentMode = modeByClaim[claimId] ?? "BANK_TRANSFER";
    try {
      await api.post(`/accounts/payments/${claimId}`, { paymentMode });
      setClaims((prev) => prev.filter((c) => c.id !== claimId));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to process payment");
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-1">Payment Processing</h1>
      <p className="text-sm text-slate-500 mb-4">
        Pending payable — every verified claim must be paid; nothing here can be dismissed, only marked paid.
      </p>
      {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Claim #</th>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Payment mode</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nothing pending payable — every verified claim has been paid.
                </td>
              </tr>
            )}
            {claims.map((claim) => (
              <tr key={claim.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">{claim.claimNumber}</td>
                <td className="px-4 py-2">{claim.employee.name}</td>
                <td className="px-4 py-2">₹{claim.totalAmount}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={claim.status} />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={modeByClaim[claim.id] ?? "BANK_TRANSFER"}
                    onChange={(e) => setModeByClaim((prev) => ({ ...prev, [claim.id]: e.target.value as never }))}
                    className="border border-slate-300 rounded-md px-2 py-1 text-sm"
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-primary text-xs" onClick={() => processPayment(claim.id)}>
                    Mark Paid
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
