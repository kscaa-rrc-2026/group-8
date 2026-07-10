import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../lib/api";

interface Department {
  id: string;
  name: string;
}

interface MatrixRule {
  id: string;
  minAmount: string;
  maxAmount: string;
  sequence: number;
  approverRole: string;
  department: Department | null;
}

const APPROVER_ROLES = ["MANAGER", "ACCOUNTS", "ADMIN"] as const;

export function ApprovalMatrix() {
  const [rules, setRules] = useState<MatrixRule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ departmentId: "", minAmount: "", maxAmount: "", sequence: "1", approverRole: "MANAGER" as (typeof APPROVER_ROLES)[number] });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.get("/admin/approval-matrix").then((res) => setRules(res.data.data));
  }

  useEffect(() => {
    refresh();
    api.get("/admin/departments").then((res) => setDepartments(res.data.data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/approval-matrix", {
        departmentId: form.departmentId || undefined,
        minAmount: Number(form.minAmount),
        maxAmount: Number(form.maxAmount),
        sequence: Number(form.sequence),
        approverRole: form.approverRole,
      });
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create rule");
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Approval Matrix</h1>

      <div className="card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Amount range</th>
              <th className="px-4 py-2 font-medium">Sequence</th>
              <th className="px-4 py-2 font-medium">Approver role</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{rule.department?.name ?? "All departments"}</td>
                <td className="px-4 py-2">
                  ₹{rule.minAmount} – ₹{rule.maxAmount}
                </td>
                <td className="px-4 py-2">{rule.sequence}</td>
                <td className="px-4 py-2">{rule.approverRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-6 max-w-xl">
        <h2 className="font-medium text-slate-800 mb-3">Add rule</h2>
        {error && <div className="badge-rejected mb-3 block w-fit">{error}</div>}
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={form.approverRole} onChange={(e) => setForm({ ...form, approverRole: e.target.value as never })} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
            {APPROVER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input placeholder="Min amount" type="number" required value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Max amount" type="number" required value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Sequence" type="number" required value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="btn-primary col-span-2">
            Add rule
          </button>
        </form>
      </div>
    </div>
  );
}
