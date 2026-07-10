import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PasswordStrengthHint, passwordMeetsRules } from "../components/PasswordStrengthHint";

export function ChangePassword() {
  const { user, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const mandatory = user?.mustChangePassword ?? false;

  const [currentPassword, setCurrentPassword] = useState("");
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
      await api.post("/auth/change-password", { currentPassword, newPassword });
      clearMustChangePassword();
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-brand-900 mb-1">Change Password</h1>
        {mandatory ? (
          <p className="text-sm text-slate-500 mb-6">
            Your password must be changed before you can continue — this is either your first login or an admin reset your password.
          </p>
        ) : (
          <p className="text-sm text-slate-500 mb-6">Update the password for your account.</p>
        )}

        {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

        <label className="block text-sm font-medium text-slate-700 mb-1">Current password</label>
        <input
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
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
          {submitting ? "Saving…" : "Change Password"}
        </button>

        {!mandatory && (
          <Link to="/" className="block text-center text-sm text-brand-700 underline mt-4">
            Cancel and go back
          </Link>
        )}
      </form>
    </div>
  );
}
