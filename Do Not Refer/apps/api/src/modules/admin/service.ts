import type { Request } from "express";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { recordAuditLog } from "../../middleware/auditLog";
import { ApiError } from "../../middleware/errorHandler";

export async function listEmployees() {
  return prisma.employee.findMany({
    where: { deletedAt: null },
    include: { department: true },
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
  const employee = await prisma.employee.create({ data: { ...rest, passwordHash } });
  await recordAuditLog({
    req,
    action: "USER_CREATE",
    entityType: "Employee",
    entityId: employee.id,
    after: { id: employee.id, employeeCode: employee.employeeCode, name: employee.name, email: employee.email, role: employee.role, departmentId: employee.departmentId },
  });
  return employee;
}

// Soft delete only — never hard-delete an Employee, claims/audit logs
// reference it.
export async function deactivateEmployee(req: Request, employeeId: string) {
  const existing = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!existing) throw new ApiError(404, "Employee not found");

  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: { isActive: false, deletedAt: new Date() },
  });
  await recordAuditLog({ req, action: "USER_DEACTIVATE", entityType: "Employee", entityId: employeeId, before: existing, after: updated });
  return updated;
}

export async function listDepartments() {
  return prisma.department.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
}

export async function listApprovalMatrix() {
  return prisma.approvalMatrix.findMany({ include: { department: true }, orderBy: [{ departmentId: "asc" }, { sequence: "asc" }] });
}
