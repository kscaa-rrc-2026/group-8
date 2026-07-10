import { Router } from "express";
import path from "path";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { ApiError } from "../middleware/errorHandler";
import { UPLOADS_ROOT } from "../lib/uploads";

export const attachmentsRouter = Router();

attachmentsRouter.use(requireAuth);

// Serves an uploaded bill so it can be previewed/downloaded. Scoped the
// same way claim approval is: an employee may only fetch attachments on
// their own claims, and a MANAGER/CEO may only fetch attachments belonging
// to a claim from one of their own direct reports (or, for CEO, their own
// claim) - being *some* manager isn't enough, same as approving a claim.
// ACCOUNTS/ADMIN keep global access since verifying/auditing any claim is
// their actual job.
attachmentsRouter.get("/:id/file", async (req, res, next) => {
  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id: req.params.id },
      include: { claim: { include: { employee: { select: { managerId: true } } } } },
    });
    if (!attachment) throw new ApiError(404, "Attachment not found");

    const isOwner = attachment.claim.employeeId === req.user!.id;
    const isAssignedManager = attachment.claim.employee.managerId === req.user!.id;
    const isGlobalReviewer = ["ACCOUNTS", "ADMIN"].includes(req.user!.role);
    if (!isOwner && !isAssignedManager && !isGlobalReviewer) {
      throw new ApiError(403, "Not authorized to view this attachment");
    }

    const absolutePath = path.join(UPLOADS_ROOT, attachment.fileUrl);
    res.sendFile(absolutePath, { headers: { "Content-Disposition": `inline; filename="${attachment.fileName}"` } }, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
});
