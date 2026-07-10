import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";
import { ChangePassword } from "./pages/ChangePassword";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";

import { Dashboard } from "./modules/employee/pages/Dashboard";
import { NewClaim } from "./modules/employee/pages/NewClaim";
import { ClaimHistory } from "./modules/employee/pages/ClaimHistory";
import { Notifications } from "./modules/employee/pages/Notifications";

import { ApprovalQueue } from "./modules/manager/pages/ApprovalQueue";
import { ClaimReview } from "./modules/manager/pages/ClaimReview";
import { Summary } from "./modules/manager/pages/Summary";

import { Verification } from "./modules/accounts/pages/Verification";
import { PaymentProcessing } from "./modules/accounts/pages/PaymentProcessing";

import { Employees } from "./modules/admin/pages/Employees";
import { Departments } from "./modules/admin/pages/Departments";
import { ApprovalMatrix } from "./modules/admin/pages/ApprovalMatrix";
import { AuditLog } from "./modules/admin/pages/AuditLog";

import { ReportsHome } from "./modules/reports/pages/ReportsHome";

function RoleHome() {
  const { user } = useAuth();
  switch (user?.role) {
    case "EMPLOYEE":
      return <Navigate to="/employee/dashboard" replace />;
    case "MANAGER":
      return <Navigate to="/manager/approvals" replace />;
    case "ACCOUNTS":
      return <Navigate to="/accounts/verification" replace />;
    case "ADMIN":
      return <Navigate to="/admin/employees" replace />;
    case "CEO":
      return <Navigate to="/manager/approvals" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RoleHome />} />

        <Route path="/employee/dashboard" element={<Dashboard />} />
        <Route path="/employee/claims/new" element={<NewClaim />} />
        <Route path="/employee/claims" element={<ClaimHistory />} />
        <Route path="/employee/notifications" element={<Notifications />} />

        <Route
          path="/manager/approvals"
          element={
            <ProtectedRoute allow={["MANAGER", "ADMIN", "CEO"]}>
              <ApprovalQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/approvals/:id"
          element={
            <ProtectedRoute allow={["MANAGER", "ADMIN", "CEO"]}>
              <ClaimReview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/summary"
          element={
            <ProtectedRoute allow={["MANAGER", "ADMIN", "CEO"]}>
              <Summary />
            </ProtectedRoute>
          }
        />

        <Route
          path="/accounts/verification"
          element={
            <ProtectedRoute allow={["ACCOUNTS", "ADMIN"]}>
              <Verification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts/payments"
          element={
            <ProtectedRoute allow={["ACCOUNTS", "ADMIN"]}>
              <PaymentProcessing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/employees"
          element={
            <ProtectedRoute allow={["ADMIN"]}>
              <Employees />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/departments"
          element={
            <ProtectedRoute allow={["ADMIN"]}>
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/approval-matrix"
          element={
            <ProtectedRoute allow={["ADMIN"]}>
              <ApprovalMatrix />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute allow={["ADMIN"]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute allow={["ACCOUNTS", "ADMIN"]}>
              <ReportsHome />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
