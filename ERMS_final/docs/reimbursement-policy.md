# Employee Expense Reimbursement Policy

This document states the reimbursement policy exactly as implemented in
ERMS — every rule below is enforced in code, not just written guidance.
Where a number is a configurable seed value rather than a hard rule, that's
noted so Admin can change it without a code change.

## 1. Who this applies to

Every employee in the organization, across every role (Employee, Manager,
Accounts, Admin, CEO). Everyone submits their own expenses the same way;
the difference is who reviews them.

## 2. Expense categories and limits

| Category | Bill required | Per-claim-line limit* |
|---|---|---|
| Travel | Yes | ₹25,000 |
| Food | Yes | ₹2,000 |
| Office Supplies | Yes | ₹5,000 |
| Other | Yes | No fixed limit — flagged for manual judgment |

\* Enforced per line item, not per whole claim — a claim with a ₹1,800
Food line and a ₹20,000 Travel line is fine; a ₹2,500 Food line is
rejected at submission with a clear error, before it ever reaches a
manager. Admin can adjust these limits or add categories going forward
(current UI supports viewing them; changing limits today requires a
direct data update — an edit form is on the roadmap).

## 3. Mandatory bill attachment

**No claim can be submitted without at least one bill/receipt attached.**
This is enforced twice:
- Client-side, in the New Claim form.
- Server-side — a claim is created in `DRAFT` and can only move to
  `SUBMITTED` once at least one attachment exists. There is no way to
  bypass this by calling the API directly.

## 4. Approval chain (maker-checker)

```
Employee submits → Manager approves → Accounts verifies → Paid
```

- **The maker can never be the checker.** An employee's claim can only be
  approved by their own assigned manager — not any manager, not anyone
  else in the same department. This is checked against the actual
  manager-employee relationship on every approval action, not just in the
  screen that lists them.
- **Every employee must have a manager assigned**, with one exception: the
  **CEO**, who sits at the top of the org chart and has no one above them.
  The CEO is the only role permitted to approve their own claim — there is
  no one else who could.
- A manager's decision is one of three things, and every one of them
  requires written remarks:
  - **Approve** — moves to Accounts for verification.
  - **Reject** — ends the claim's life; remarks are the reason on record.
  - **Return** — sends it back to the employee to fix and resubmit
    (e.g. missing detail, wrong category). The employee can resubmit as
    many times as needed; each resubmission re-enters the same manager's
    queue.
- Accounts verification is a second, independent check with the same
  approve/reject-with-remarks pattern, plus duplicate detection (below).

## 5. Duplicate and fraud detection

Before a claim can be verified, Accounts runs a duplicate check. A claim
is flagged as a possible duplicate if either is true:
- Another claim from the **same employee**, for the **same amount**,
  within a **7-day window** of the same expense date, already exists.
- One of its bill attachments has the exact same file content (by hash)
  as an attachment on a different claim.

**A flagged claim cannot be verified or paid.** This isn't a warning that
can be clicked past — the verify action itself is refused until the flag
is resolved (by rejecting the claim or investigating further). This is
checked automatically every time verification is attempted, not just when
someone remembers to click "run duplicate check."

## 6. Payment

- Payment is only possible from a **verified** claim, and a claim can
  never be paid twice — the system enforces this even under concurrent
  requests, not just via a status label.
- Every verified-but-unpaid claim shows up in Accounts' Payment
  Processing queue as **pending payable** — nothing verified can be
  silently forgotten; it's either paid or still sitting in that list.
- Supported payment modes: Bank Transfer, Cheque, Cash.

## 7. Security & access control

- **Role-based access** is enforced on every request server-side, never
  just by hiding a button in the UI.
- **Audit trail**: every create, update, approval, rejection, payment,
  login, and password change is recorded in an append-only log — nothing
  in it can be edited or deleted, and it's visible to Admin (Audit Log
  screen).
- **Soft delete**: an employee or department is never hard-deleted, only
  deactivated — history and audit trail stay intact.
- **A manager can't be deactivated while they still have active direct
  reports** — their reports would otherwise have no reachable approver at
  all. Reassign reports to another manager first.
- **Session timeout**: a session expires after a period of genuine
  inactivity (not a fixed timer from login) — see Section 9.
- **Password policy**: every password, whether set by an employee or by
  Admin, must be at least 8 characters with an uppercase letter, a
  lowercase letter, a number, and a special character.
- **First login / after a reset**: an employee must change their password
  before doing anything else in the system.

## 8. Password management

- **Self-service change**: any logged-in employee can change their own
  password (requires the current one).
- **Forgot password**: an employee who can't log in can request a reset
  link from the login screen.
- **Admin reset**: Admin can reset any employee's password directly from
  the Employees screen, generating a one-time temporary password the
  employee must change at next login.

## 9. Session & idle timeout

A session is invalidated after a configurable period of inactivity
(default: 20 minutes) — this is tracked against actual request activity,
not a fixed clock started at login, so an actively-working session isn't
cut off arbitrarily while a genuinely idle one is.

## 10. Reporting

Finance/Accounts and Admin can generate Employee-wise, Department-wise,
Monthly, Payment, and Rejected reports, each exportable as CSV (Excel/PDF
export are on the roadmap).

## 11. What's on the roadmap, not yet enforced

- **Multi-level approval by amount** — the data model supports
  department/amount-based escalation rules, but the live approval flow
  today is always exactly one manager step regardless of claim size.
- **OCR-based bill data extraction** and **AI-assisted fraud scoring** —
  the duplicate check above is the deterministic baseline this would
  augment, not replace.
- **MFA (multi-factor authentication)** — the data model supports it;
  enrollment isn't wired up yet.

These are called out explicitly rather than silently implied, since the
gap between "the schema supports it" and "the system enforces it" matters
for anyone relying on this policy document.
