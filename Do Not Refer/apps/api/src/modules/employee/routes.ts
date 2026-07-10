import { Router } from "express";
import { createHash } from "crypto";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errorHandler";
import * as employeeService from "./service";

export const employeeRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

employeeRouter.use(requireAuth, requireRole("EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN"));

// GET /api/employee/claims — Claim History screen
employeeRouter.get("/claims", async (req, res, next) => {
  try {
    const claims = await employeeService.listMyClaims(req.user!);
    res.json({ data: claims });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get("/claims/:id", async (req, res, next) => {
  try {
    const claim = await employeeService.getMyClaim(req.user!, req.params.id);
    res.json({ data: claim });
  } catch (err) {
    next(err);
  }
});

const createClaimSchema = z.object({
  lineItems: z
    .array(
      z.object({
        categoryId: z.string(),
        expenseDate: z.string(),
        amount: z.number().positive(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

// POST /api/employee/claims — New Claim screen
employeeRouter.post("/claims", async (req, res, next) => {
  try {
    const { lineItems } = createClaimSchema.parse(req.body);
    const claim = await employeeService.createClaim(req, req.user!, lineItems);
    res.status(201).json({ data: claim });
  } catch (err) {
    next(err);
  }
});

// POST /api/employee/claims/:id/attachments — Upload Bills screen.
// Bills are mandatory before a claim can leave DRAFT — enforce that in the
// New Claim flow on the frontend, not just here.
employeeRouter.post("/claims/:id/attachments", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "No file uploaded");

    const claim = await prisma.claim.findFirst({ where: { id: req.params.id, employeeId: req.user!.id, deletedAt: null } });
    if (!claim) throw new ApiError(404, "Claim not found");

    const fileHash = createHash("sha256").update(req.file.buffer).digest("hex");

    // TODO(accounts workstream): duplicate detection compares fileHash +
    // (employeeId, amount, expenseDate) across claims before ACCOUNTS_VERIFIED.
    const attachment = await prisma.attachment.create({
      data: {
        claimId: claim.id,
        fileName: req.file.originalname,
        fileUrl: `local://uploads/${claim.id}/${req.file.originalname}`, // TODO: real object storage
        fileHash,
      },
    });

    res.status(201).json({ data: attachment });
  } catch (err) {
    next(err);
  }
});

// GET /api/employee/notifications — Notifications screen
employeeRouter.get("/notifications", async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: notifications });
  } catch (err) {
    next(err);
  }
});

employeeRouter.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const notification = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true },
    });
    res.json({ data: notification });
  } catch (err) {
    next(err);
  }
});
