import type { Request } from "express";
import { prisma } from "../lib/prisma";

interface RecordAuditLogParams {
  req: Request;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

// Call this from inside every mutating service function — after the DB
// write succeeds — for Claim/ApprovalStep/Payment/Employee/Department and
// any other entity with financial or access-control impact. AuditLog rows
// are append-only: never update or delete one.
export async function recordAuditLog({ req, action, entityType, entityId, before, after }: RecordAuditLogParams) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      action,
      entityType,
      entityId,
      beforeData: before === undefined ? undefined : (before as object),
      afterData: after === undefined ? undefined : (after as object),
      ipAddress: req.ip,
    },
  });
}
