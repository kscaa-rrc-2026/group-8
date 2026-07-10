export type ClaimStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "MANAGER_APPROVED"
  | "MANAGER_REJECTED"
  | "MANAGER_RETURNED"
  | "ACCOUNTS_VERIFIED"
  | "ACCOUNTS_REJECTED"
  | "PAID";

const BADGE_CLASS: Record<ClaimStatus, string> = {
  DRAFT: "badge-pending",
  SUBMITTED: "badge-pending",
  MANAGER_APPROVED: "badge-approved",
  MANAGER_REJECTED: "badge-rejected",
  MANAGER_RETURNED: "badge-returned",
  ACCOUNTS_VERIFIED: "badge-approved",
  ACCOUNTS_REJECTED: "badge-rejected",
  PAID: "badge-paid",
};

const LABEL: Record<ClaimStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending Manager Review",
  MANAGER_APPROVED: "Approved by Manager",
  MANAGER_REJECTED: "Rejected by Manager",
  MANAGER_RETURNED: "Returned by Manager",
  ACCOUNTS_VERIFIED: "Verified",
  ACCOUNTS_REJECTED: "Rejected by Accounts",
  PAID: "Paid",
};

// The one place that maps ClaimStatus -> color/label. Use this everywhere a
// status is shown instead of switching on the string locally.
export function StatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={BADGE_CLASS[status]}>{LABEL[status]}</span>;
}
