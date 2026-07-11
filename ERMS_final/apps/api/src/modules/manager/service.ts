import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import { SAFE_EMPLOYEE_SELECT } from "../../lib/employeeSelect";
import { createNotification } from "../../lib/notifications";
import type { AuthUser } from "../../types";

// A claim is only ever this manager's to approve if they are the specific
// employee's assigned manager - being in the same department is not
// enough. The one carve-out: CEO has no manager above them, so their own
// claims appear in their own queue to self-approve.
// TODO: extend to walk ApprovalMatrix by amount for multi-level chains
// (e.g. large claims escalate to a second approver after the manager).
export async function listPendingApprovals(user: AuthUser) {
  return prisma.claim.findMany({
    where: {
      status: "SUBMITTED",
      deletedAt: null,
      OR: [{ employee: { managerId: user.id } }, ...(user.role === "CEO" ? [{ employeeId: user.id }] : [])],
    },
    include: { employee: { select: SAFE_EMPLOYEE_SELECT }, lineItems: true, attachments: true },
    orderBy: { submittedAt: "asc" },
  });
}

// A claim leaves the Approval Queue the moment a manager acts on it, with
// nowhere to see that decision again afterward. This is based on the
// manager's own ApprovalStep history (not current claim.status), so an
// approved claim still shows up here even after it's since moved on to
// ACCOUNTS_VERIFIED/PAID/ACCOUNTS_REJECTED - "current status" reflects
// that ongoing outcome, "decision" is what this manager actually did.
export async function getApprovalSummary(user: AuthUser) {
  const steps = await prisma.approvalStep.findMany({
    where: { approverId: user.id, approverRole: "MANAGER" },
    include: { claim: { include: { employee: { select: SAFE_EMPLOYEE_SELECT } } } },
    orderBy: { actedAt: "desc" },
  });

  const rows = steps.map((s) => ({
    id: s.claim.id,
    claimNumber: s.claim.claimNumber,
    employeeName: s.claim.employee.name,
    totalAmount: s.claim.totalAmount,
    approvedAmount: s.approvedAmount,
    decision: s.action,
    currentStatus: s.claim.status,
    remarks: s.remarks,
    actedAt: s.actedAt,
  }));

  return {
    approvedCount: rows.filter((r) => r.decision === "APPROVE").length,
    returnedCount: rows.filter((r) => r.decision === "RETURN").length,
    rejectedCount: rows.filter((r) => r.decision === "REJECT").length,
    claims: rows,
  };
}

export async function getClaimForReview(user: AuthUser, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, deletedAt: null },
    include: { employee: { select: SAFE_EMPLOYEE_SELECT }, lineItems: true, attachments: true, approvalSteps: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");

  const isAssignedManager = claim.employee.managerId === user.id;
  const isCeoSelfReviewing = user.role === "CEO" && claim.employeeId === user.id;
  if (!isAssignedManager && !isCeoSelfReviewing && user.role !== "ADMIN") {
    throw new ApiError(403, "Only this employee's assigned manager may review their claim");
  }

  return claim;
}

type Decision = "APPROVE" | "REJECT" | "RETURN";

const STATUS_BY_DECISION: Record<Decision, string> = {
  APPROVE: "MANAGER_APPROVED",
  REJECT: "MANAGER_REJECTED",
  RETURN: "MANAGER_RETURNED",
};

const NOTIFICATION_TYPE_BY_DECISION: Record<Decision, "CLAIM_APPROVED" | "CLAIM_REJECTED" | "CLAIM_RETURNED"> = {
  APPROVE: "CLAIM_APPROVED",
  REJECT: "CLAIM_REJECTED",
  RETURN: "CLAIM_RETURNED",
};

export async function decideClaim(
  req: Request,
  user: AuthUser,
  claimId: string,
  decision: Decision,
  remarks: string,
  approvedAmount?: number,
) {
  if (!remarks?.trim()) {
    throw new ApiError(400, "Remarks are required for every approval decision");
  }

  const claim = await prisma.claim.findFirst({ where: { id: claimId, deletedAt: null }, include: { employee: { select: { managerId: true } } } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "SUBMITTED") {
    throw new ApiError(409, `Claim is not awaiting manager review (status: ${claim.status})`);
  }

  const isAssignedManager = claim.employee.managerId === user.id;
  const isCeoSelfApproving = user.role === "CEO" && claim.employeeId === user.id;
  if (!isAssignedManager && !isCeoSelfApproving) {
    throw new ApiError(403, "Only this employee's assigned manager may approve their claim");
  }

  // A manager may approve less than the full claimed amount - defaults to
  // the full amount when not specified, so a plain Approve behaves exactly
  // as before. Only meaningful for APPROVE; REJECT/RETURN never set it.
  let resolvedApprovedAmount: number | null = null;
  if (decision === "APPROVE") {
    resolvedApprovedAmount = approvedAmount ?? Number(claim.totalAmount);
    if (resolvedApprovedAmount <= 0 || resolvedApprovedAmount > Number(claim.totalAmount)) {
      throw new ApiError(400, `Approved amount must be between ₹0 and the claimed amount (₹${claim.totalAmount})`);
    }
  }

  const nextStatus = STATUS_BY_DECISION[decision];

  const updatedClaim = await prisma.$transaction(async (tx) => {
    // Atomic guard: only writes if status is still SUBMITTED at the moment
    // of the update, closing the check-then-write race window between the
    // findFirst above and this write (e.g. a double-click submitting two
    // decisions for the same claim almost simultaneously).
    const { count } = await tx.claim.updateMany({
      where: { id: claim.id, status: "SUBMITTED" },
      data: {
        status: nextStatus as never,
        currentApprovalStep: { increment: 1 },
        approvedAmount: resolvedApprovedAmount,
      },
    });
    if (count === 0) {
      throw new ApiError(409, "Claim was already processed by someone else");
    }
    await tx.approvalStep.create({
      data: {
        claimId: claim.id,
        stepNumber: claim.currentApprovalStep + 1,
        approverRole: "MANAGER",
        approverId: user.id,
        action: decision,
        approvedAmount: resolvedApprovedAmount,
        remarks,
        actedAt: new Date(),
      },
    });
    return { status: nextStatus, approvedAmount: resolvedApprovedAmount };
  });

  await recordAuditLog({
    req,
    action: `CLAIM_${decision}`,
    entityType: "Claim",
    entityId: claim.id,
    before: { status: claim.status },
    after: { status: updatedClaim.status, remarks, approvedAmount: updatedClaim.approvedAmount },
  });

  const isPartialApproval = decision === "APPROVE" && resolvedApprovedAmount !== null && resolvedApprovedAmount < Number(claim.totalAmount);
  const decisionVerb = decision === "APPROVE" ? (isPartialApproval ? `partially approved (₹${resolvedApprovedAmount} of ₹${claim.totalAmount})` : "approved") : decision === "REJECT" ? "rejected" : "returned";
  await createNotification(
    claim.employeeId,
    NOTIFICATION_TYPE_BY_DECISION[decision],
    decision === "APPROVE" ? (isPartialApproval ? "Claim partially approved" : "Claim approved") : decision === "REJECT" ? "Claim rejected" : "Claim returned for correction",
    `Your manager ${decisionVerb} claim ${claim.claimNumber}: ${remarks}`,
  );

  return updatedClaim;
}
