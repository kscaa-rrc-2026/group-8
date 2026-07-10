import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../lib/api";

interface Department {
  id: string;
  name: string;
  code: string;
  costCenter: string | null;
}

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ name: "", code: "", costCenter: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.get("/admin/departments").then((res) => setDepartments(res.data.data));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/departments", form);
      setForm({ name: "", code: "", costCenter: "" });
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create department");
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Departments</h1>

      <div className="card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Cost center</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-700">{d.name}</td>
                <td className="px-4 py-2">{d.code}</td>
                <td className="px-4 py-2">{d.costCenter ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-6 max-w-md">
        <h2 className="font-medium text-slate-800 mb-3">Add department</h2>
        {error && <div className="badge-rejected mb-3 block w-fit">{error}</div>}
        <form onSubmit={handleCreate} className="space-y-3">
          <input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Cost center (optional)" value={form.costCenter} onChange={(e) => setForm({ ...form, costCenter: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <button type="submit" className="btn-primary w-full">
            Create department
          </button>
        </form>
      </div>
    </div>
  );
}
