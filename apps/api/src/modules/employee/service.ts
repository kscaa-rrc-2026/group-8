import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import type { AuthUser } from "../../types";

interface LineItemInput {
  categoryId: string;
  expenseDate: string;
  amount: number;
  description?: string;
}

export async function listMyClaims(user: AuthUser) {
  return prisma.claim.findMany({
    where: { employeeId: user.id, deletedAt: null },
    include: { lineItems: true, attachments: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyClaim(user: AuthUser, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, employeeId: user.id, deletedAt: null },
    include: { lineItems: true, attachments: true, approvalSteps: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  return claim;
}

// Reference pattern for the whole app: validate ownership, write the
// change, then record an audit log entry for it in the same request.
export async function createClaim(req: Request, user: AuthUser, lineItems: LineItemInput[]) {
  if (lineItems.length === 0) {
    throw new ApiError(400, "A claim needs at least one line item");
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const claimNumber = `CLM-${Date.now()}`;

  const claim = await prisma.claim.create({
    data: {
      claimNumber,
      employeeId: user.id,
      departmentId: user.departmentId,
      totalAmount,
      status: "SUBMITTED",
      submittedAt: new Date(),
      lineItems: {
        create: lineItems.map((item) => ({
          categoryId: item.categoryId,
          expenseDate: new Date(item.expenseDate),
          amount: item.amount,
          description: item.description,
        })),
      },
    },
    include: { lineItems: true },
  });

  await recordAuditLog({ req, action: "CLAIM_SUBMIT", entityType: "Claim", entityId: claim.id, after: claim });

  return claim;
}
