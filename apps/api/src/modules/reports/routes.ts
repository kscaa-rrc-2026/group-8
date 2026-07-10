import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { ApiError } from "../../middleware/errorHandler";
import * as reportsService from "./service";

export const reportsRouter = Router();

reportsRouter.use(requireAuth, requireRole("ACCOUNTS", "ADMIN"));

// Every report route supports ?format=csv, defaulting to JSON. Add xlsx/pdf
// the same way once those export helpers exist in service.ts.
function respond(res: import("express").Response, format: string | undefined, rows: Record<string, unknown>[]) {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=report.csv");
    return res.send(reportsService.toCsv(rows));
  }
  return res.json({ data: rows });
}

reportsRouter.get("/employee-wise", async (req, res, next) => {
  try {
    const rows = await reportsService.employeeWiseReport();
    respond(res, req.query.format as string, rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/department-wise", async (req, res, next) => {
  try {
    const rows = await reportsService.departmentWiseReport();
    respond(res, req.query.format as string, rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/monthly", async (req, res, next) => {
  try {
    const month = req.query.month as string;
    if (!month) throw new ApiError(400, "month query param is required, e.g. ?month=2026-07");
    const rows = await reportsService.monthlyReport(month);
    respond(res, req.query.format as string, rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/payments", async (req, res, next) => {
  try {
    const rows = await reportsService.paymentReport();
    respond(res, req.query.format as string, rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/rejected", async (req, res, next) => {
  try {
    const rows = await reportsService.rejectedReport();
    respond(res, req.query.format as string, rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    next(err);
  }
});
