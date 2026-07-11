import type { Request } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import { UPLOADS_ROOT } from "../../lib/uploads";
import { createNotification } from "../../lib/notifications";
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

// Shared by createClaim and updateClaimLineItems - checks every category
// exists and every line item is within its category's per-line limit, then
// returns the rounded total. Round to paise - amount arrives as a JS float
// over the wire, and summing floats can leave rounding dust (e.g. 0.1 + 0.2)
// in a total that should be exact currency.
async function validateLineItemsAndComputeTotal(lineItems: LineItemInput[]): Promise<number> {
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

  return Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
}

// Reference pattern for the whole app: validate, write the change, then
// record an audit log entry for it in the same request. Created as DRAFT,
// not SUBMITTED - submitClaim() is what actually puts it in front of a
// manager, and it refuses to do that without a bill attached.
export async function createClaim(req: Request, user: AuthUser, lineItems: LineItemInput[]) {
  const totalAmount = await validateLineItemsAndComputeTotal(lineItems);
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
    include: { attachments: true, employee: { select: { managerId: true, name: true } } },
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

  // No manager to notify for the CEO, who has none above them and
  // self-approves - createNotification would otherwise be called with a
  // null userId.
  if (claim.employee.managerId) {
    await createNotification(
      claim.employee.managerId,
      "CLAIM_SUBMITTED",
      "New claim submitted",
      `${claim.employee.name} submitted claim ${claim.claimNumber} for ₹${claim.totalAmount}, awaiting your review.`,
    );
  }

  return updated;
}

// Same mandatory-attachment rule applies on resubmission after a manager
// returns a claim for correction.
export async function resubmitClaim(req: Request, user: AuthUser, claimId: string) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, employeeId: user.id, deletedAt: null },
    include: { attachments: true, employee: { select: { managerId: true, name: true } } },
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

  if (claim.employee.managerId) {
    await createNotification(
      claim.employee.managerId,
      "CLAIM_SUBMITTED",
      "Claim resubmitted",
      `${claim.employee.name} resubmitted claim ${claim.claimNumber} for ₹${claim.totalAmount} after your return, awaiting your review.`,
    );
  }

  return updated;
}

// Lets the employee actually fix what the manager's remarks called out
// before resubmitting, instead of resubmitting the exact same line items
// unchanged. Same editable window as attachments (requireOwnedEditableClaim
// in routes.ts): DRAFT or MANAGER_RETURNED only - once a claim has moved
// past that, its line items are part of the record a manager already acted
// on and can't be silently rewritten.
export async function updateClaimLineItems(req: Request, user: AuthUser, claimId: string, lineItems: LineItemInput[]) {
  const claim = await prisma.claim.findFirst({
    where: { id: claimId, employeeId: user.id, deletedAt: null },
    include: { lineItems: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "DRAFT" && claim.status !== "MANAGER_RETURNED") {
    throw new ApiError(409, `Cannot edit a claim in status ${claim.status}`);
  }

  const totalAmount = await validateLineItemsAndComputeTotal(lineItems);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.claimLineItem.deleteMany({ where: { claimId } });
    await tx.claimLineItem.createMany({
      data: lineItems.map((item) => ({
        claimId,
        categoryId: item.categoryId,
        expenseDate: new Date(item.expenseDate),
        amount: item.amount,
        description: item.description,
      })),
    });
    return tx.claim.update({
      where: { id: claimId },
      data: { totalAmount },
      include: { lineItems: true, attachments: true },
    });
  });

  await recordAuditLog({
    req,
    action: "CLAIM_UPDATE",
    entityType: "Claim",
    entityId: claim.id,
    before: { lineItems: claim.lineItems, totalAmount: claim.totalAmount },
    after: { lineItems: updated.lineItems, totalAmount: updated.totalAmount },
  });

  return updated;
}

// Lets the employee remove a wrongly-attached bill before resubmitting -
// same editable window as adding one. Deletes the DB row first; the file
// itself is best-effort cleanup, since a claim's validity never depends on
// the file actually being gone from disk.
export async function deleteAttachment(req: Request, user: AuthUser, claimId: string, attachmentId: string) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, employeeId: user.id, deletedAt: null } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "DRAFT" && claim.status !== "MANAGER_RETURNED") {
    throw new ApiError(409, `Cannot remove an attachment from a claim in status ${claim.status}`);
  }

  const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, claimId } });
  if (!attachment) throw new ApiError(404, "Attachment not found");

  await prisma.attachment.delete({ where: { id: attachmentId } });
  await recordAuditLog({ req, action: "ATTACHMENT_DELETE", entityType: "Attachment", entityId: attachmentId, before: attachment });

  fs.unlink(path.join(UPLOADS_ROOT, attachment.fileUrl), () => {});

  return attachment;
}
