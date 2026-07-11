import type { Request } from "express";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import { SAFE_EMPLOYEE_SELECT } from "../../lib/employeeSelect";
import { createNotification } from "../../lib/notifications";
import type { AuthUser } from "../../types";

export async function listPendingVerification() {
  return prisma.claim.findMany({
    where: { status: "MANAGER_APPROVED", deletedAt: null },
    include: { employee: { select: SAFE_EMPLOYEE_SELECT }, lineItems: true, attachments: true },
    orderBy: { updatedAt: "asc" },
  });
}

// Every claim that reaches ACCOUNTS_VERIFIED must eventually be paid - this
// is that queue. A claim only leaves it via processPayment(), which flips
// status to PAID, so nothing verified can be silently forgotten: it always
// shows up here as pending payable until it's actually paid.
export async function listPendingPayments() {
  return prisma.claim.findMany({
    where: { status: "ACCOUNTS_VERIFIED", deletedAt: null },
    include: { employee: { select: SAFE_EMPLOYEE_SELECT }, lineItems: true },
    orderBy: { updatedAt: "asc" },
  });
}

// Duplicate detection: same employee + same amount within a 7-day window of
// the same expense date, OR an identical attachment file hash on a
// different claim. Refreshes Claim.isDuplicateFlagged as a side effect -
// decideVerification() calls this itself before allowing VERIFY, so a
// flagged claim can never be waved through unexamined.
// TODO(AI roadmap): replace/augment with an ML-based fraud score; this is
// the deterministic baseline the policy requires today.
async function checkForDuplicates(claimId: string) {
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
  await prisma.claim.update({ where: { id: claim.id }, data: { isDuplicateFlagged: isDuplicate } });

  return {
    isDuplicate,
    matchingAttachments: hashMatches.map((m) => ({ claimId: m.claimId, claimNumber: m.claim.claimNumber })),
    matchingClaims: amountMatches.map((m) => ({ id: m.id, claimNumber: m.claimNumber })),
  };
}

// On-demand duplicate check for the Verification screen's "run check" button.
export async function detectDuplicates(claimId: string) {
  return checkForDuplicates(claimId);
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

  if (decision === "VERIFY") {
    const { isDuplicate } = await checkForDuplicates(claim.id);
    if (isDuplicate) {
      throw new ApiError(409, "This claim is flagged as a possible duplicate and cannot be verified — reject it or investigate first");
    }
  }

  const nextStatus = decision === "VERIFY" ? "ACCOUNTS_VERIFIED" : "ACCOUNTS_REJECTED";

  const updatedClaim = await prisma.$transaction(async (tx) => {
    // Atomic guard: only writes if status is still MANAGER_APPROVED at the
    // moment of the update, closing the check-then-write race window
    // between the findFirst above and this write.
    const { count } = await tx.claim.updateMany({
      where: { id: claim.id, status: "MANAGER_APPROVED" },
      data: { status: nextStatus },
    });
    if (count === 0) {
      throw new ApiError(409, "Claim was already processed by someone else");
    }
    await tx.approvalStep.create({
      data: {
        claimId: claim.id,
        stepNumber: claim.currentApprovalStep + 1,
        approverRole: "ACCOUNTS",
        approverId: user.id,
        action: decision === "VERIFY" ? "APPROVE" : "REJECT",
        remarks,
        actedAt: new Date(),
      },
    });
    return { status: nextStatus };
  });

  await recordAuditLog({
    req,
    action: `CLAIM_ACCOUNTS_${decision}`,
    entityType: "Claim",
    entityId: claim.id,
    before: { status: claim.status },
    after: { status: updatedClaim.status, remarks },
  });

  await createNotification(
    claim.employeeId,
    decision === "VERIFY" ? "CLAIM_VERIFIED" : "CLAIM_REJECTED",
    decision === "VERIFY" ? "Claim verified by Accounts" : "Claim rejected by Accounts",
    `Accounts ${decision === "VERIFY" ? "verified" : "rejected"} claim ${claim.claimNumber}: ${remarks}`,
  );

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
  // Defense in depth — decideVerification already refuses to verify a
  // flagged claim, so this shouldn't normally trip, but payment is the
  // highest-risk action in the system and this is cheap insurance.
  if (claim.isDuplicateFlagged) {
    throw new ApiError(409, "This claim is flagged as a possible duplicate and cannot be paid");
  }

  const payment = await prisma.$transaction(async (tx) => {
    const { count } = await tx.claim.updateMany({
      where: { id: claim.id, status: "ACCOUNTS_VERIFIED" },
      data: { status: "PAID" },
    });
    if (count === 0) {
      throw new ApiError(409, "Claim was already paid or its status changed");
    }
    // Pay the manager-approved amount, not the originally claimed total -
    // a partial approval means only that portion was ever authorized.
    // approvedAmount is only null for claims approved before this field
    // existed; totalAmount is the correct fallback for those.
    return tx.payment.create({
      data: {
        claimId: claim.id,
        amount: claim.approvedAmount ?? claim.totalAmount,
        paymentMode: input.paymentMode,
        transactionRef: input.transactionRef,
        processedById: user.id,
      },
    });
  });

  await recordAuditLog({ req, action: "CLAIM_PAID", entityType: "Claim", entityId: claim.id, after: payment });

  await createNotification(
    claim.employeeId,
    "CLAIM_PAID",
    "Payment processed",
    `Your claim ${claim.claimNumber} has been paid: ₹${payment.amount} via ${input.paymentMode}${input.transactionRef ? ` (ref: ${input.transactionRef})` : ""}.`,
  );

  return payment;
}
