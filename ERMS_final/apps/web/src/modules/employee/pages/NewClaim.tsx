import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../lib/api";

interface Category {
  id: string;
  name: string;
}

interface LineItemForm {
  categoryId: string;
  expenseDate: string;
  amount: string;
  description: string;
}

interface ExistingAttachment {
  id: string;
  fileName: string;
}

interface ApprovalStep {
  action: "APPROVE" | "REJECT" | "RETURN" | null;
  remarks: string | null;
  actedAt: string | null;
}

const EMPTY_ITEM: LineItemForm = { categoryId: "", expenseDate: "", amount: "", description: "" };

export function NewClaim() {
  const navigate = useNavigate();
  const { id: claimId } = useParams<{ id: string }>();
  const isEdit = Boolean(claimId);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<LineItemForm[]>([{ ...EMPTY_ITEM }]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
  const [returnRemarks, setReturnRemarks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    api.get("/employee/categories").then((res) => setCategories(res.data.data));
  }, []);

  useEffect(() => {
    if (!claimId) return;
    api.get(`/employee/claims/${claimId}`).then((res) => {
      const claim = res.data.data;
      setItems(
        claim.lineItems.map((li: any) => ({
          categoryId: li.categoryId,
          expenseDate: li.expenseDate.slice(0, 10),
          amount: String(li.amount),
          description: li.description ?? "",
        })),
      );
      setExistingAttachments(claim.attachments.map((a: any) => ({ id: a.id, fileName: a.fileName })));
      const lastReturn = (claim.approvalSteps as ApprovalStep[])
        .filter((s) => s.action === "RETURN")
        .sort((a, b) => new Date(b.actedAt ?? 0).getTime() - new Date(a.actedAt ?? 0).getTime())[0];
      setReturnRemarks(lastReturn?.remarks ?? null);
      setLoaded(true);
    });
  }, [claimId]);

  function updateItem(index: number, patch: Partial<LineItemForm>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function removeExistingAttachment(attachmentId: string) {
    setError(null);
    try {
      await api.delete(`/employee/claims/${claimId}/attachments/${attachmentId}`);
      setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to remove attachment");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Mandatory bill attachment per the problem statement's internal
    // controls — enforced here in addition to whatever the backend does.
    if (files.length === 0 && existingAttachments.length === 0) {
      setError("At least one bill attachment is required.");
      return;
    }

    setSubmitting(true);
    try {
      const lineItems = items.map((item) => ({
        categoryId: item.categoryId,
        expenseDate: item.expenseDate,
        amount: Number(item.amount),
        description: item.description || undefined,
      }));

      let targetClaimId = claimId;
      if (isEdit) {
        await api.put(`/employee/claims/${claimId}`, { lineItems });
      } else {
        const { data } = await api.post("/employee/claims", { lineItems });
        targetClaimId = data.data.id;
      }

      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        await api.post(`/employee/claims/${targetClaimId}/attachments`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      // Claims are created as DRAFT — submit is what actually puts one in
      // front of a manager. A returned claim re-enters the same manager's
      // queue via resubmit instead. The API refuses either without an
      // attachment.
      if (isEdit) {
        await api.post(`/employee/claims/${targetClaimId}/resubmit`);
      } else {
        await api.post(`/employee/claims/${targetClaimId}/submit`);
      }

      navigate("/employee/claims");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Failed to submit claim");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return <div className="text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-semibold text-slate-900 mb-4">{isEdit ? "Edit Claim" : "New Claim"}</h1>

      {isEdit && returnRemarks && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Your manager returned this claim:</span> {returnRemarks}
        </div>
      )}

      {error && <div className="badge-rejected mb-4 block w-fit">{error}</div>}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-2 gap-3 pb-4 border-b border-slate-100 last:border-0">
            <select
              value={item.categoryId}
              onChange={(e) => updateItem(index, { categoryId: e.target.value })}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              required
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
            <div className="flex gap-2">
              <input
                placeholder="Description (optional)"
                value={item.description}
                onChange={(e) => updateItem(index, { description: e.target.value })}
                className="border border-slate-300 rounded-md px-3 py-2 text-sm flex-1"
              />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(index)} className="text-xs text-slate-400 hover:text-red-600">
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        <button type="button" className="btn-secondary" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          + Add line item
        </button>

        {isEdit && existingAttachments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Already attached</label>
            <ul className="text-sm space-y-1">
              {existingAttachments.map((a) => (
                <li key={a.id} className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-1.5">
                  <span>{a.fileName}</span>
                  <button type="button" onClick={() => removeExistingAttachment(a.id)} className="text-xs text-slate-400 hover:text-red-600">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {isEdit ? "Add more bill attachments" : "Bill attachments (required)"}
          </label>
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Submitting…" : isEdit ? "Resubmit Claim" : "Submit Claim"}
        </button>
      </form>
    </div>
  );
}
