import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { PasswordStrengthHint, passwordMeetsRules } from "../components/PasswordStrengthHint";

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordMeetsRules(newPassword)) {
      setError("New password doesn't meet the requirements below.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      navigate("/login");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-brand-900 mb-1">Reset Password</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your reset token and choose a new password.</p>

        {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

        <label className="block text-sm font-medium text-slate-700 mb-1">Reset token</label>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4 font-mono text-xs"
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-2"
        />
        <PasswordStrengthHint password={newPassword} />

        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
        />

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Resetting…" : "Reset Password"}
        </button>

        <Link to="/login" className="block text-center text-sm text-brand-700 underline mt-4">
          Back to login
        </Link>
      </form>
    </div>
  );
}
