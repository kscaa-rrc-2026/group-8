import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { toCsv } from "../../lib/csv";
import * as managerService from "./service";

export const managerRouter = Router();

managerRouter.use(requireAuth, requireRole("MANAGER", "ADMIN", "CEO"));

// Shared by every ?format=csv route below — mirrors the Reports module's
// respond() helper.
function respondCsv(res: Response, filename: string, rows: Record<string, unknown>[]) {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(toCsv(rows));
}

// GET /api/manager/approvals — Approval Queue screen (?format=csv to export)
managerRouter.get("/approvals", async (req, res, next) => {
  try {
    const claims = await managerService.listPendingApprovals(req.user!);
    if (req.query.format === "csv") {
      return respondCsv(
        res,
        "approval-queue.csv",
        claims.map((c) => ({
          claimNumber: c.claimNumber,
          employeeName: c.employee.name,
          totalAmount: c.totalAmount,
          status: c.status,
          submittedAt: c.submittedAt,
        })),
      );
    }
    res.json({ data: claims });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/approvals/:id — Claim Review screen
managerRouter.get("/approvals/:id", async (req, res, next) => {
  try {
    const claim = await managerService.getClaimForReview(req.user!, req.params.id);
    res.json({ data: claim });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/summary — Approval Summary screen (?format=csv to export)
managerRouter.get("/summary", async (req, res, next) => {
  try {
    const summary = await managerService.getApprovalSummary(req.user!);
    if (req.query.format === "csv") {
      return respondCsv(
        res,
        "approval-summary.csv",
        summary.claims.map((c) => ({
          claimNumber: c.claimNumber,
          employeeName: c.employeeName,
          totalAmount: c.totalAmount,
          decision: c.decision,
          currentStatus: c.currentStatus,
          remarks: c.remarks,
          actedAt: c.actedAt,
        })),
      );
    }
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT", "RETURN"]),
  remarks: z.string().min(1, "Remarks are required"),
});

// POST /api/manager/approvals/:id/decision — Approve / Reject / Return with remarks
managerRouter.post("/approvals/:id/decision", async (req, res, next) => {
  try {
    const { decision, remarks } = decisionSchema.parse(req.body);
    const claim = await managerService.decideClaim(req, req.user!, req.params.id, decision, remarks);
    res.json({ data: claim });
  } catch (err) {
    next(err);
  }
});
