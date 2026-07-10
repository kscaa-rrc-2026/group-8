import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devOnlyToken, setDevOnlyToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.data.message);
      setDevOnlyToken(data.data.devOnlyToken ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-brand-900 mb-1">Forgot Password</h1>
        <p className="text-sm text-slate-500 mb-6">Enter your account email and we'll generate a reset link.</p>

        {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

        {!message ? (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
            />
            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        ) : (
          <div>
            <p className="text-sm text-slate-700 mb-4">{message}</p>
            {devOnlyToken && (
              <div className="border border-dashed border-status-pending rounded-md p-3 mb-4">
                <p className="text-xs text-status-pending font-medium mb-2">
                  DEV MODE ONLY — no email service is configured, so the reset link is shown here instead of being emailed:
                </p>
                <Link to={`/reset-password?token=${devOnlyToken}`} className="text-xs text-brand-700 underline break-all">
                  /reset-password?token={devOnlyToken}
                </Link>
              </div>
            )}
          </div>
        )}

        <Link to="/login" className="block text-center text-sm text-brand-700 underline mt-4">
          Back to login
        </Link>
      </div>
    </div>
  );
}
