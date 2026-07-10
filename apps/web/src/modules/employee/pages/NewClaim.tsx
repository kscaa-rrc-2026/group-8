import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";

interface LineItemForm {
  categoryId: string;
  expenseDate: string;
  amount: string;
  description: string;
}

const EMPTY_ITEM: LineItemForm = { categoryId: "", expenseDate: "", amount: "", description: "" };

export function NewClaim() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LineItemForm[]>([{ ...EMPTY_ITEM }]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(index: number, patch: Partial<LineItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Mandatory bill attachment per the problem statement's internal
    // controls — enforced here in addition to whatever the backend does.
    if (files.length === 0) {
      setError("At least one bill attachment is required.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post("/employee/claims", {
        lineItems: items.map((item) => ({
          categoryId: item.categoryId,
          expenseDate: item.expenseDate,
          amount: Number(item.amount),
          description: item.description || undefined,
        })),
      });

      const claimId = data.data.id;
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await api.post(`/employee/claims/${claimId}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      navigate("/employee/claims");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">New Claim</h1>

      {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100 last:border-0">
            {/* TODO(admin workstream): populate categoryId from
                GET /api/admin/... expense categories instead of free text
                once that endpoint exists. */}
            <input
              placeholder="Category ID"
              value={item.categoryId}
              onChange={(e) => updateItem(index, { categoryId: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              required
            />
            <input
              type="date"
              value={item.expenseDate}
              onChange={(e) => updateItem(index, { expenseDate: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={item.amount}
              onChange={(e) => updateItem(index, { amount: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              required
            />
            <input
              placeholder="Description (optional)"
              value={item.description}
              onChange={(e) => updateItem(index, { description: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        ))}

        <button type="button" className="btn-secondary" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          + Add line item
        </button>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Bill attachments (required)</label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Submitting…" : "Submit Claim"}
        </button>
      </form>
    </div>
  );
}
