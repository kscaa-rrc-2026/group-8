import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import * as managerService from "./service";

export const managerRouter = Router();

managerRouter.use(requireAuth, requireRole("MANAGER", "ADMIN"));

// GET /api/manager/approvals — Approval Queue screen
managerRouter.get("/approvals", async (req, res, next) => {
  try {
    const claims = await managerService.listPendingApprovals(req.user!);
    res.json({ data: claims });
  } catch (err) {
    next(err);
  }
});

// GET /api/manager/approvals/:id — Claim Review screen
managerRouter.get("/approvals/:id", async (req, res, next) => {
  try {
    const claim = await managerService.getClaimForReview(req.params.id);
    res.json({ data: claim });
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
