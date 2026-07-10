import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { prisma } from "../../lib/prisma";
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

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN"]),
  departmentId: z.string(),
  managerId: z.string().optional(),
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
