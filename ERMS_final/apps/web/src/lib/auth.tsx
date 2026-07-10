import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "./api";

export type Role = "EMPLOYEE" | "MANAGER" | "ACCOUNTS" | "ADMIN" | "CEO";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string, mfaToken?: string) => Promise<AuthUser>;
  logout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("erms_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  async function login(email: string, password: string, mfaToken?: string) {
    const { data } = await api.post("/auth/login", { email, password, mfaToken });
    localStorage.setItem("erms_token", data.data.token);
    localStorage.setItem("erms_user", JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user as AuthUser;
  }

  function logout() {
    localStorage.removeItem("erms_token");
    localStorage.removeItem("erms_user");
    setUser(null);
  }

  function clearMustChangePassword() {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, mustChangePassword: false };
      localStorage.setItem("erms_user", JSON.stringify(next));
      return next;
    });
  }

  return <AuthContext.Provider value={{ user, login, logout, clearMustChangePassword }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
