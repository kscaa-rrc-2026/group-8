import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../lib/api";

interface Department {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  department: Department;
}

const ROLES = ["EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN"] as const;

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ employeeCode: "", name: "", email: "", password: "", role: "EMPLOYEE" as (typeof ROLES)[number], departmentId: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.get("/admin/employees").then((res) => setEmployees(res.data.data));
  }

  useEffect(() => {
    refresh();
    api.get("/admin/departments").then((res) => setDepartments(res.data.data));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/admin/employees", form);
      setForm({ employeeCode: "", name: "", email: "", password: "", role: "EMPLOYEE", departmentId: "" });
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create employee");
    }
  }

  async function handleDeactivate(id: string) {
    await api.delete(`/admin/employees/${id}`);
    refresh();
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Employees</h1>

      <div className="card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{emp.employeeCode}</td>
                <td className="px-4 py-2 font-medium text-slate-700">{emp.name}</td>
                <td className="px-4 py-2">{emp.email}</td>
                <td className="px-4 py-2">{emp.role}</td>
                <td className="px-4 py-2">{emp.department?.name}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDeactivate(emp.id)} className="btn-secondary text-xs text-status-rejected">
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card p-6 max-w-xl">
        <h2 className="font-medium text-slate-800 mb-3">Add employee</h2>
        {error && <div className="badge-rejected mb-3 block w-fit">{error}</div>}
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
          <input placeholder="Employee code" required value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <input placeholder="Temporary password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as never })} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select value={form.departmentId} required onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary col-span-2">
            Create employee
          </button>
        </form>
      </div>
    </div>
  );
}
