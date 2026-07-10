import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../lib/api";

interface Department {
  id: string;
  name: string;
}

interface MatrixRule {
  id: string;
  departmentId: string | null;
  minAmount: string;
  maxAmount: string;
  sequence: number;
  approverRole: string;
  department: Department | null;
}

const APPROVER_ROLES = ["MANAGER", "ACCOUNTS", "ADMIN"] as const;

type EditForm = {
  departmentId: string;
  minAmount: string;
  maxAmount: string;
  sequence: string;
  approverRole: (typeof APPROVER_ROLES)[number];
};

export function ApprovalMatrix() {
  const [rules, setRules] = useState<MatrixRule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ departmentId: "", minAmount: "", maxAmount: "", sequence: "1", approverRole: "MANAGER" as (typeof APPROVER_ROLES)[number] });
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

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

  function startEdit(rule: MatrixRule) {
    setError(null);
    setEditingId(rule.id);
    setEditForm({
      departmentId: rule.departmentId ?? "",
      minAmount: rule.minAmount,
      maxAmount: rule.maxAmount,
      sequence: String(rule.sequence),
      approverRole: rule.approverRole as (typeof APPROVER_ROLES)[number],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setError(null);
    try {
      await api.patch(`/admin/approval-matrix/${id}`, {
        departmentId: editForm.departmentId || undefined,
        minAmount: Number(editForm.minAmount),
        maxAmount: Number(editForm.maxAmount),
        sequence: Number(editForm.sequence),
        approverRole: editForm.approverRole,
      });
      cancelEdit();
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to update rule");
    }
  }

  async function deleteRule(id: string) {
    setError(null);
    try {
      await api.delete(`/admin/approval-matrix/${id}`);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to delete rule");
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
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) =>
              editingId === rule.id && editForm ? (
                <tr key={rule.id} className="border-t border-slate-100 bg-brand-50">
                  <td className="px-4 py-2">
                    <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 text-sm w-full">
                      <option value="">All departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <input type="number" value={editForm.minAmount} onChange={(e) => setEditForm({ ...editForm, minAmount: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 text-sm w-24" />
                      <input type="number" value={editForm.maxAmount} onChange={(e) => setEditForm({ ...editForm, maxAmount: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 text-sm w-24" />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" value={editForm.sequence} onChange={(e) => setEditForm({ ...editForm, sequence: e.target.value })} className="border border-slate-300 rounded-md px-2 py-1 text-sm w-16" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={editForm.approverRole} onChange={(e) => setEditForm({ ...editForm, approverRole: e.target.value as never })} className="border border-slate-300 rounded-md px-2 py-1 text-sm">
                      {APPROVER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => saveEdit(rule.id)} className="btn-primary text-xs mr-2">
                      Save
                    </button>
                    <button onClick={cancelEdit} className="btn-secondary text-xs">
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={rule.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">{rule.department?.name ?? "All departments"}</td>
                  <td className="px-4 py-2">
                    ₹{rule.minAmount} – ₹{rule.maxAmount}
                  </td>
                  <td className="px-4 py-2">{rule.sequence}</td>
                  <td className="px-4 py-2">{rule.approverRole}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(rule)} className="btn-secondary text-xs mr-2">
                      Edit
                    </button>
                    <button onClick={() => deleteRule(rule.id)} className="btn-secondary text-xs text-status-rejected">
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
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
