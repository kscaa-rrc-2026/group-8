import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../../lib/api";
import { PasswordStrengthHint } from "../../../components/PasswordStrengthHint";

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
  manager: { id: string; name: string } | null;
}

const ROLES = ["EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN", "CEO"] as const;

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ employeeCode: "", name: "", email: "", password: "", role: "EMPLOYEE" as (typeof ROLES)[number], departmentId: "", managerId: "" });
  const [error, setError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);

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
    if (form.role !== "CEO" && !form.managerId) {
      setError("A manager is required for every role except CEO.");
      return;
    }
    try {
      await api.post("/admin/employees", { ...form, managerId: form.role === "CEO" ? undefined : form.managerId });
      setForm({ employeeCode: "", name: "", email: "", password: "", role: "EMPLOYEE", departmentId: "", managerId: "" });
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to create employee");
    }
  }

  async function handleDeactivate(id: string) {
    setError(null);
    try {
      await api.delete(`/admin/employees/${id}`);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to deactivate employee");
    }
  }

  async function handleResetPassword(emp: Employee) {
    setError(null);
    setResetResult(null);
    try {
      const { data } = await api.post(`/admin/employees/${emp.id}/reset-password`);
      setResetResult({ name: emp.name, tempPassword: data.data.tempPassword });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to reset password");
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Employees</h1>

      {resetResult && (
        <div className="card p-4 mb-4 border-status-approved">
          <p className="text-sm text-slate-700">
            New temporary password for <strong>{resetResult.name}</strong> (shown once — communicate it out of band, they'll be required to change it at next login):
          </p>
          <p className="font-mono text-sm bg-slate-100 rounded px-2 py-1 mt-2 inline-block">{resetResult.tempPassword}</p>
          <button onClick={() => setResetResult(null)} className="btn-secondary text-xs ml-3">
            Dismiss
          </button>
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Department</th>
              <th className="px-4 py-2 font-medium">Manager</th>
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
                <td className="px-4 py-2">{emp.manager?.name ?? (emp.role === "CEO" ? "— (top of org)" : "—")}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button onClick={() => handleResetPassword(emp)} className="btn-secondary text-xs mr-2">
                    Reset Password
                  </button>
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
          <div className="col-span-2">
            <input placeholder="Temporary password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-1" />
            <PasswordStrengthHint password={form.password} />
          </div>
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
          {form.role === "CEO" ? (
            <div className="border border-dashed border-slate-300 rounded-md px-3 py-2 text-sm text-slate-400 flex items-center">
              No manager — top of the org
            </div>
          ) : (
            <select value={form.managerId} required onChange={(e) => setForm({ ...form, managerId: e.target.value })} className="border border-slate-300 rounded-md px-3 py-2 text-sm">
              <option value="">Select manager</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.role})
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn-primary col-span-2">
            Create employee
          </button>
        </form>
      </div>
    </div>
  );
}
