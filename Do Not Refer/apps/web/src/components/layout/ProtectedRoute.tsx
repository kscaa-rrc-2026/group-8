import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth, type Role } from "../../lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allow?: Role[];
}

// Server-side RBAC (apps/api/src/middleware/rbac.ts) is the real gate —
// this only prevents an unauthorized user from seeing a screen they'd get
// a 403 from anyway.
export function ProtectedRoute({ children, allow }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) return <Navigate to="/" replace />;

  return <>{children}</>;
}
