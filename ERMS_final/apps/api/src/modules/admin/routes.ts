import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errorHandler";
import { passwordSchema } from "../../lib/password";
import * as adminService from "./service";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

// GET /api/admin/employees — Employee Master screen
adminRouter.get("/employees", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.listEmployees() });
  } catch (err) {
    next(err);
  }
});

// Every employee must have a manager assigned - the sole exception is
// CEO, who sits at the top of the org chart and has no one above them.
const createEmployeeSchema = z
  .object({
    employeeCode: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    password: passwordSchema,
    role: z.enum(["EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN", "CEO"]),
    departmentId: z.string(),
    managerId: z.string().optional(),
  })
  .refine((data) => data.role === "CEO" || !!data.managerId, {
    message: "A manager is required for every role except CEO",
    path: ["managerId"],
  });

adminRouter.post("/employees", async (req, res, next) => {
  try {
    const input = createEmployeeSchema.parse(req.body);
    const employee = await adminService.createEmployee(req, input);
    res.status(201).json({ data: employee });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/employees/:id", async (req, res, next) => {
  try {
    const employee = await adminService.deactivateEmployee(req, req.params.id);
    res.json({ data: employee });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/employees/:id/reset-password — generates a one-time
// temp password (shown once in this response — there's no email service
// in this scaffold) and forces the employee to change it at next login.
adminRouter.post("/employees/:id/reset-password", async (req, res, next) => {
  try {
    const result = await adminService.resetEmployeePassword(req, req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET/POST /api/admin/departments — Department Master screen
adminRouter.get("/departments", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.listDepartments() });
  } catch (err) {
    next(err);
  }
});

const createDepartmentSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  costCenter: z.string().optional(),
});

adminRouter.post("/departments", async (req, res, next) => {
  try {
    const input = createDepartmentSchema.parse(req.body);
    const department = await prisma.department.create({ data: input });
    res.status(201).json({ data: department });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return next(new ApiError(409, `Department code "${req.body.code}" is already in use`));
    }
    next(err);
  }
});

// GET /api/admin/approval-matrix — Approval Matrix screen
adminRouter.get("/approval-matrix", async (_req, res, next) => {
  try {
    res.json({ data: await adminService.listApprovalMatrix() });
  } catch (err) {
    next(err);
  }
});

const approvalMatrixSchema = z.object({
  departmentId: z.string().optional(),
  minAmount: z.number().nonnegative(),
  maxAmount: z.number().positive(),
  sequence: z.number().int().positive(),
  approverRole: z.enum(["MANAGER", "ACCOUNTS", "ADMIN"]),
});

adminRouter.post("/approval-matrix", async (req, res, next) => {
  try {
    const input = approvalMatrixSchema.parse(req.body);
    const rule = await prisma.approvalMatrix.create({ data: input });
    res.status(201).json({ data: rule });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/approval-matrix/:id", async (req, res, next) => {
  try {
    const input = approvalMatrixSchema.parse(req.body);
    const rule = await prisma.approvalMatrix.update({ where: { id: req.params.id }, data: input });
    res.json({ data: rule });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete("/approval-matrix/:id", async (req, res, next) => {
  try {
    await prisma.approvalMatrix.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const isValidDateString = (v: string) => !isNaN(Date.parse(v));

const auditLogQuerySchema = z.object({
  entityType: z.string().optional(),
  action: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().refine(isValidDateString, "from must be a valid date").optional(),
  to: z.string().refine(isValidDateString, "to must be a valid date").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// GET /api/admin/audit-log — Audit Log viewer screen
adminRouter.get("/audit-log", async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const result = await adminService.listAuditLogs(query);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});
