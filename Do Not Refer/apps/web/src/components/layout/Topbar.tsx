import { useAuth } from "../../lib/auth";

export function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6">
      <div className="text-sm text-slate-500">Expense Reimbursement Management System</div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-slate-700">
          {user?.name} <span className="text-slate-400 font-normal">({user?.role})</span>
        </span>
        <button onClick={logout} className="btn-secondary">
          Log out
        </button>
      </div>
    </header>
  );
}
