import type { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

// Same call shape as recordAuditLog: call this once per claim status
// change, right after the DB write that caused it succeeds, for whoever
// needs to act next or needs to know what happened (the assigned manager
// on submission, the employee on every manager/accounts decision and on
// payment).
export async function createNotification(userId: string, type: NotificationType, title: string, message: string) {
  await prisma.notification.create({ data: { userId, type, title, message } });
}
