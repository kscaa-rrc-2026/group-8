import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import * as accountsService from "./service";

export const accountsRouter = Router();

accountsRouter.use(requireAuth, requireRole("ACCOUNTS", "ADMIN"));

// GET /api/accounts/verification — Verification queue screen
accountsRouter.get("/verification", async (_req, res, next) => {
  try {
    const claims = await accountsService.listPendingVerification();
    res.json({ data: claims });
  } catch (err) {
    next(err);
  }
});

// GET /api/accounts/verification/:id/duplicates — Duplicate Detection screen
accountsRouter.get("/verification/:id/duplicates", async (req, res, next) => {
  try {
    const result = await accountsService.detectDuplicates(req.params.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

const verificationDecisionSchema = z.object({
  decision: z.enum(["VERIFY", "REJECT"]),
  remarks: z.string().min(1, "Remarks are required"),
});

accountsRouter.post("/verification/:id/decision", async (req, res, next) => {
  try {
    const { decision, remarks } = verificationDecisionSchema.parse(req.body);
    const claim = await accountsService.decideVerification(req, req.user!, req.params.id, decision, remarks);
    res.json({ data: claim });
  } catch (err) {
    next(err);
  }
});

const paymentSchema = z.object({
  paymentMode: z.enum(["BANK_TRANSFER", "CHEQUE", "CASH"]),
  transactionRef: z.string().optional(),
});

// POST /api/accounts/payments/:claimId — Payment Processing screen
accountsRouter.post("/payments/:claimId", async (req, res, next) => {
  try {
    const input = paymentSchema.parse(req.body);
    const payment = await accountsService.processPayment(req, req.user!, req.params.claimId, input);
    res.status(201).json({ data: payment });
  } catch (err) {
    next(err);
  }
});
