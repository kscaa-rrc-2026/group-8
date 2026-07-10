import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const loggedInUser = await login(email, password, mfaToken || undefined);
      navigate(loggedInUser.mustChangePassword ? "/change-password" : "/");
    } catch (err: any) {
      if (err?.response?.data?.error?.code === "MFA_REQUIRED") {
        setNeedsMfa(true);
        return;
      }
      setError(err?.response?.data?.error?.message ?? "Login failed");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-brand-900 mb-1">ERMS</h1>
        <p className="text-sm text-slate-500 mb-6">Expense Reimbursement Management System</p>

        {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
        />

        {needsMfa && (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-1">MFA code</label>
            <input
              type="text"
              value={mfaToken}
              onChange={(e) => setMfaToken(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
            />
          </>
        )}

        <button type="submit" className="btn-primary w-full">
          Sign in
        </button>

        <Link to="/forgot-password" className="block text-center text-sm text-brand-700 underline mt-4">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
