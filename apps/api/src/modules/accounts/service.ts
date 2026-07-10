import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import type { AuthUser } from "../../types";

export async function listPendingVerification() {
  return prisma.claim.findMany({
    where: { status: "MANAGER_APPROVED", deletedAt: null },
    include: { employee: true, lineItems: true, attachments: true },
    orderBy: { updatedAt: "asc" },
  });
}

// Duplicate detection: same employee + same amount within a 7-day window of
// the same expense date, OR an identical attachment file hash on a
// different claim. Runs before ACCOUNTS_VERIFIED — see root CLAUDE.md.
// TODO(AI roadmap): replace/augment with an ML-based fraud score; this is
// the deterministic baseline the policy requires today.
export async function detectDuplicates(claimId: string) {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: { lineItems: true, attachments: true },
  });
  if (!claim) throw new ApiError(404, "Claim not found");

  const hashes = claim.attachments.map((a) => a.fileHash);
  const hashMatches = hashes.length
    ? await prisma.attachment.findMany({
        where: { fileHash: { in: hashes }, claimId: { not: claim.id } },
        include: { claim: true },
      })
    : [];

  const amountMatches = await prisma.claim.findMany({
    where: {
      id: { not: claim.id },
      employeeId: claim.employeeId,
      totalAmount: claim.totalAmount,
      deletedAt: null,
      createdAt: {
        gte: new Date(claim.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        lte: new Date(claim.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  const isDuplicate = hashMatches.length > 0 || amountMatches.length > 0;

  if (isDuplicate) {
    await prisma.claim.update({ where: { id: claim.id }, data: { isDuplicateFlagged: true } });
  }

  return {
    isDuplicate,
    matchingAttachments: hashMatches.map((m) => ({ claimId: m.claimId, claimNumber: m.claim.claimNumber })),
    matchingClaims: amountMatches.map((m) => ({ id: m.id, claimNumber: m.claimNumber })),
  };
}

type Decision = "VERIFY" | "REJECT";

export async function decideVerification(req: Request, user: AuthUser, claimId: string, decision: Decision, remarks: string) {
  if (!remarks?.trim()) {
    throw new ApiError(400, "Remarks are required for every verification decision");
  }

  const claim = await prisma.claim.findFirst({ where: { id: claimId, deletedAt: null } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "MANAGER_APPROVED") {
    throw new ApiError(409, `Claim is not awaiting accounts verification (status: ${claim.status})`);
  }

  const nextStatus = decision === "VERIFY" ? "ACCOUNTS_VERIFIED" : "ACCOUNTS_REJECTED";

  const [updatedClaim] = await prisma.$transaction([
    prisma.claim.update({ where: { id: claim.id }, data: { status: nextStatus } }),
    prisma.approvalStep.create({
      data: {
        claimId: claim.id,
        stepNumber: claim.currentApprovalStep + 1,
        approverRole: "ACCOUNTS",
        approverId: user.id,
        action: decision === "VERIFY" ? "APPROVE" : "REJECT",
        remarks,
        actedAt: new Date(),
      },
    }),
  ]);

  await recordAuditLog({
    req,
    action: `CLAIM_ACCOUNTS_${decision}`,
    entityType: "Claim",
    entityId: claim.id,
    before: { status: claim.status },
    after: { status: updatedClaim.status, remarks },
  });

  return updatedClaim;
}

export async function processPayment(
  req: Request,
  user: AuthUser,
  claimId: string,
  input: { paymentMode: "BANK_TRANSFER" | "CHEQUE" | "CASH"; transactionRef?: string },
) {
  const claim = await prisma.claim.findFirst({ where: { id: claimId, deletedAt: null } });
  if (!claim) throw new ApiError(404, "Claim not found");
  if (claim.status !== "ACCOUNTS_VERIFIED") {
    throw new ApiError(409, `Claim is not verified for payment (status: ${claim.status})`);
  }

  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        claimId: claim.id,
        amount: claim.totalAmount,
        paymentMode: input.paymentMode,
        transactionRef: input.transactionRef,
        processedById: user.id,
      },
    }),
    prisma.claim.update({ where: { id: claim.id }, data: { status: "PAID" } }),
  ]);

  await recordAuditLog({ req, action: "CLAIM_PAID", entityType: "Claim", entityId: claim.id, after: payment });

  return payment;
}
