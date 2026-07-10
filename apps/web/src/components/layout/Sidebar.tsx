import { NavLink } from "react-router-dom";
import type { Role } from "../../lib/auth";

interface NavItem {
  to: string;
  label: string;
}

// Shared nav shell — one entry per module. Each of the 5 workstreams adds
// its own items here rather than rendering a competing nav inside its
// module folder.
const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { to: "/employee/dashboard", label: "Dashboard" },
    { to: "/employee/claims/new", label: "New Claim" },
    { to: "/employee/claims", label: "Claim History" },
    { to: "/employee/notifications", label: "Notifications" },
  ],
  MANAGER: [
    { to: "/manager/approvals", label: "Approval Queue" },
    { to: "/employee/claims", label: "My Claims" },
  ],
  ACCOUNTS: [
    { to: "/accounts/verification", label: "Verification" },
    { to: "/accounts/payments", label: "Payment Processing" },
    { to: "/reports", label: "Reports" },
  ],
  ADMIN: [
    { to: "/admin/employees", label: "Employees" },
    { to: "/admin/departments", label: "Departments" },
    { to: "/admin/approval-matrix", label: "Approval Matrix" },
    { to: "/reports", label: "Reports" },
  ],
};

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="w-60 shrink-0 bg-brand-900 text-brand-100 min-h-screen p-4">
      <div className="text-white font-semibold text-lg mb-6 px-2">ERMS</div>
      <nav className="flex flex-col gap-1">
        {NAV_BY_ROLE[role].map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-brand-700 text-white" : "text-brand-200 hover:bg-brand-800 hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
