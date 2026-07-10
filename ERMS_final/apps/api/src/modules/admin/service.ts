import type { Request } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";
import { SAFE_EMPLOYEE_SELECT } from "../../lib/employeeSelect";

export async function listEmployees() {
  return prisma.employee.findMany({
    where: { deletedAt: null },
    select: { ...SAFE_EMPLOYEE_SELECT, department: true, manager: { select: SAFE_EMPLOYEE_SELECT } },
    orderBy: { name: "asc" },
  });
}

interface CreateEmployeeInput {
  employeeCode: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  departmentId: string;
  managerId?: string;
}

// Reference pattern for this module: hash the password, write the row,
// audit-log it. Follow this shape for department/approval-matrix mutations.
export async function createEmployee(req: Request, input: CreateEmployeeInput) {
  const { password, ...rest } = input;
  const passwordHash = await bcrypt.hash(password, 10);

  let employee;
  try {
    employee = await prisma.employee.create({ data: { ...rest, passwordHash }, select: SAFE_EMPLOYEE_SELECT });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const field = (err.meta?.target as string[] | undefined)?.[0] ?? "field";
      throw new ApiError(409, `That ${field} is already in use by another employee`);
    }
    throw err;
  }

  await recordAuditLog({
    req,
    action: "USER_CREATE",
    entityType: "Employee",
    entityId: employee.id,
    after: employee,
  });
  return employee;
}

// Soft delete only — never hard-delete an Employee, claims/audit logs
// reference it. Both fetches below use SAFE_EMPLOYEE_SELECT deliberately -
// this record also becomes the audit log's before/after snapshot, and that
// snapshot is permanent and shown directly in the Audit Log screen, so it
// must never carry passwordHash/mfaSecret/passwordResetToken either.
export async function deactivateEmployee(req: Request, employeeId: string) {
  const existing = await prisma.employee.findUnique({ where: { id: employeeId }, select: SAFE_EMPLOYEE_SELECT });
  if (!existing) throw new ApiError(404, "Employee not found");

  // Deactivating someone still leaves their direct reports' claims with no
  // reachable approver at all - approval is strictly scoped to the
  // assigned manager, and a deactivated manager can no longer log in to
  // act on them. Reassign reports to another manager first.
  const reportCount = await prisma.employee.count({ where: { managerId: employeeId, deletedAt: null } });
  if (reportCount > 0) {
    throw new ApiError(409, `This employee still has ${reportCount} active direct report(s) — reassign them to another manager before deactivating`);
  }

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: { isActive: false, deletedAt: new Date() },
    select: SAFE_EMPLOYEE_SELECT,
  });
  await recordAuditLog({ req, action: "USER_DEACTIVATE", entityType: "Employee", entityId: employeeId, before: existing, after: updated });
  return updated;
}

// Meets passwordSchema (apps/api/src/lib/password.ts) by construction -
// one char from each required class, then padding, then shuffled. Uses
// crypto.randomInt (not Math.random(), which isn't cryptographically
// secure) for both character selection and the shuffle, matching the
// reset-token generator in apps/api/src/auth/routes.ts.
function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%^&*";
  const all = upper + lower + digits + special;
  const pick = (charset: string) => charset[randomInt(charset.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special), ...Array.from({ length: 8 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// Admin-initiated reset: generates a one-time temporary password (there's
// no email service in this scaffold, so the admin communicates it to the
// employee out of band) and forces a change on next login.
export async function resetEmployeePassword(req: Request, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new ApiError(404, "Employee not found");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.employee.update({
    where: { id: employeeId },
    data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() },
  });
  await recordAuditLog({ req, action: "PASSWORD_RESET_ADMIN", entityType: "Employee", entityId: employeeId });

  return { tempPassword };
}

export async function listDepartments() {
  return prisma.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function listApprovalMatrix() {
  return prisma.approvalMatrix.findMany({ include: { department: true }, orderBy: [{ departmentId: "asc" }, { sequence: "asc" }] });
}

interface AuditLogFilters {
  entityType?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

// Every mutation in the system already writes an AuditLog row via
// recordAuditLog() (apps/api/src/middleware/auditLog.ts) - this just
// exposes that append-only trail for review, it never writes to it.
export async function listAuditLogs(filters: AuditLogFilters) {
  const where: Prisma.AuditLogWhereInput = {
    entityType: filters.entityType || undefined,
    action: filters.action || undefined,
    userId: filters.userId || undefined,
    createdAt: {
      gte: filters.from ? new Date(filters.from) : undefined,
      lte: filters.to ? new Date(filters.to) : undefined,
    },
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  return { total, page: filters.page, pageSize: filters.pageSize, logs };
}
