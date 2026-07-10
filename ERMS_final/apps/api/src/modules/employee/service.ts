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

// Backs the New Claim form's category dropdown - never hardcode category
// IDs client-side, they're generated per-database (cuid) and change on
// every reseed.
export async function listCategories() {
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
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

// Reference pattern for the whole app: validate, write the change, then
// record an audit log entry for it in the same request. Created as DRAFT,
// not SUBMITTED - submitClaim() is what actually puts it in front of a
// manager, and it refuses to do that without a bill attached.
export async function createClaim(req: Request, user: AuthUser, lineItems: LineItemInput[]) {
  if (lineItems.length === 0) {
    throw new ApiError(400, "A claim needs at least one line item");
  }

  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: lineItems.map((i) => i.categoryId) } },
  });
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  for (const item of lineItems) {
    const category = categoryById.get(item.categoryId);
    if (!category) {
      throw new ApiError(400, "One of the selected categories doesn't exist");
    }
    if (category.maxAmount !== null && item.amount > Number(category.maxAmount)) {
      throw new ApiError(400, `${category.name} expenses cannot exceed ₹${category.maxAmount} per line item (got ₹${item.amount})`);
    }
  }

  // Round to paise - lineItems.amount arrives as a JS float over the wire,
  // and summing floats can leave rounding dust (e.g. 0.1 + 0.2) in a total
  // that should be exact currency.
  const totalAmount = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
  const claimNumber = `CLM-${Date.now()}`;

  const claim = await prisma.claim.create({
    data: {
      claimNumber,
      employeeId: user.id,
      departmentId: user.departmentId,
      totalAmount,
      status: "DRAFT",
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

  await recordAuditLog({ req, action: "CLAIM_CREATE", entityType: "Claim", entityId: claim.id, after: claim });

  return claim;
}

// Server-side enforcement of "mandatory bill attachment" - a claim can
// never reach SUBMITTED without at least one Attachment row, regardless of
// what the New Claim form does or doesn't check client-side.
export async function submitClaim(req: Request, user: AuthUser, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, employeeId: user.id, deletedAt: null },
    include: { attachments: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "DRAFT") {
    throw new ApiError(409, `Claim is not a draft (status: ${claim.status})`);
  }
  if (claim.attachments.length === 0) {
    throw new ApiError(400, "At least one bill attachment is required before submitting");
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  await recordAuditLog({ req, action: "CLAIM_SUBMIT", entityType: "Claim", entityId: claim.id, before: { status: claim.status }, after: { status: updated.status } });

  return updated;
}

// Same mandatory-attachment rule applies on resubmission after a manager
// returns a claim for correction.
export async function resubmitClaim(req: Request, user: AuthUser, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, employeeId: user.id, deletedAt: null },
    include: { attachments: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "MANAGER_RETURNED") {
    throw new ApiError(409, `Claim is not in a returned state (status: ${claim.status})`);
  }
  if (claim.attachments.length === 0) {
    throw new ApiError(400, "At least one bill attachment is required before resubmitting");
  }

  const updated = await prisma.claim.update({
    where: { id: claim.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  await recordAuditLog({ req, action: "CLAIM_RESUBMIT", entityType: "Claim", entityId: claim.id, before: { status: claim.status }, after: { status: updated.status } });

  return updated;
}
