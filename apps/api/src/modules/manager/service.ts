import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import type { AuthUser } from "../../types";

// TODO: this only looks at claims in the manager's own department at step 1.
// Extend to walk ApprovalMatrix by amount/department for multi-level chains
// (e.g. large claims escalate to a second approver after the manager).
export async function listPendingApprovals(user: AuthUser) {
  return prisma.claim.findMany({
    where: {
      departmentId: user.departmentId,
      status: "SUBMITTED",
      deletedAt: null,
    },
    include: { employee: true, lineItems: true, attachments: true },
    orderBy: { submittedAt: "asc" },
  });
}

export async function getClaimForReview(claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, deletedAt: null },
    include: { employee: true, lineItems: true, attachments: true, approvalSteps: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  return claim;
}

type Decision = "APPROVE" | "REJECT" | "RETURN";

const STATUS_BY_DECISION: Record<Decision, string> = {
  APPROVE: "MANAGER_APPROVED",
  REJECT: "MANAGER_REJECTED",
  RETURN: "MANAGER_RETURNED",
};

export async function decideClaim(req: Request, user: AuthUser, claimId: string, decision: Decision, remarks: string) {
  if (!remarks?.trim()) {
    throw new ApiError(400, "Remarks are required for every approval decision");
  }

  const claim = await prisma.claim.findFirst({ where: { id: claimId, departmentId: user.departmentId, deletedAt: null } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "SUBMITTED") {
    throw new ApiError(409, `Claim is not awaiting manager review (status: ${claim.status})`);
  }

  const [updatedClaim] = await prisma.$transaction([
    prisma.claim.update({
      where: { id: claim.id },
      data: { status: STATUS_BY_DECISION[decision] as never, currentApprovalStep: { increment: 1 } },
    }),
    prisma.approvalStep.create({
      data: {
        claimId: claim.id,
        stepNumber: claim.currentApprovalStep + 1,
        approverRole: "MANAGER",
        approverId: user.id,
        action: decision,
        remarks,
        actedAt: new Date(),
      },
    }),
  ]);

  await recordAuditLog({
    req,
    action: `CLAIM_${decision}`,
    entityType: "Claim",
    entityId: claim.id,
    before: { status: claim.status },
    after: { status: updatedClaim.status, remarks },
  });

  // TODO(employee workstream / notifications): create a Notification row
  // for claim.employeeId here so the employee sees the decision in real time.

  return updatedClaim;
}
