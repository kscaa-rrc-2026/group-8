import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { useAuth } from "./lib/auth";
import { Login } from "./pages/Login";

import { Dashboard } from "./modules/employee/pages/Dashboard";
import { NewClaim } from "./modules/employee/pages/NewClaim";
import { ClaimHistory } from "./modules/employee/pages/ClaimHistory";
import { Notifications } from "./modules/employee/pages/Notifications";

import { ApprovalQueue } from "./modules/manager/pages/ApprovalQueue";
import { ClaimReview } from "./modules/manager/pages/ClaimReview";

import { Verification } from "./modules/accounts/pages/Verification";
import { PaymentProcessing } from "./modules/accounts/pages/PaymentProcessing";

import { Employees } from "./modules/admin/pages/Employees";
import { Departments } from "./modules/admin/pages/Departments";
import { ApprovalMatrix } from "./modules/admin/pages/ApprovalMatrix";

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
    default:
      return <Navigate to="/login" replace />;
  }
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

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
            <ProtectedRoute allow={["MANAGER", "ADMIN"]}>
              <ApprovalQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager/approvals/:id"
          element={
            <ProtectedRoute allow={["MANAGER", "ADMIN"]}>
              <ClaimReview />
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
