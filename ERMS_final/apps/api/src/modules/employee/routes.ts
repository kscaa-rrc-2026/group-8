import { Router, type NextFunction, type Request, type Response } from "express";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { prisma } from "../../lib/prisma";
import { ApiError } from "../../middleware/errorHandler";
import { UPLOADS_ROOT, ensureUploadDir } from "../../lib/uploads";
import * as employeeService from "./service";

export const employeeRouter = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => cb(null, ensureUploadDir(req.params.id)),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

employeeRouter.use(requireAuth, requireRole("EMPLOYEE", "MANAGER", "ACCOUNTS", "ADMIN", "CEO"));

// Runs BEFORE multer so a claim's ownership/state is verified before any
// filesystem write happens - multer's destination callback uses the raw
// :id param as a directory name, so letting it run first on an
// unvalidated id is how a crafted id (e.g. "../../../x") could write
// outside uploads/ entirely regardless of whether the claim is real.
async function requireOwnedEditableClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const claim = await prisma.claim.findFirst({
      where: { id: req.params.id, employeeId: req.user!.id, deletedAt: null },
    });
    if (!claim) return res.status(404).json({ error: { message: "Claim not found" } });
    if (claim.status !== "DRAFT" && claim.status !== "MANAGER_RETURNED") {
      return res.status(409).json({ error: { message: `Cannot attach a bill to a claim in status ${claim.status}` } });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// GET /api/employee/categories — populates the New Claim category dropdown
employeeRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await employeeService.listCategories();
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

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

// POST /api/employee/claims — New Claim screen. Creates as DRAFT; the
// frontend must call POST /claims/:id/submit once at least one bill is
// attached (see requireOwnedEditableClaim + submitClaim - a claim with
// zero attachments can never reach SUBMITTED).
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
employeeRouter.post("/claims/:id/attachments", requireOwnedEditableClaim, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError(400, "No file uploaded");

    const fileHash = createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

    // TODO(accounts workstream): duplicate detection compares fileHash +
    // (employeeId, amount, expenseDate) across claims before ACCOUNTS_VERIFIED.
    const attachment = await prisma.attachment.create({
      data: {
        claimId: req.params.id,
        fileName: req.file.originalname,
        // Path relative to UPLOADS_ROOT — resolved back to an absolute path
        // by the shared download route in src/attachments/routes.ts.
        fileUrl: path.relative(UPLOADS_ROOT, req.file.path).split(path.sep).join("/"),
        fileHash,
      },
    });

    res.status(201).json({ data: attachment });
  } catch (err) {
    next(err);
  }
});

// POST /api/employee/claims/:id/submit — moves a DRAFT claim to SUBMITTED.
// Refuses if no bill attachment exists yet (server-side enforcement of the
// mandatory-bill-attachment policy — the New Claim form's own check is not
// sufficient, since it can be bypassed by calling the API directly).
employeeRouter.post("/claims/:id/submit", async (req, res, next) => {
  try {
    const claim = await employeeService.submitClaim(req, req.user!, req.params.id);
    res.json({ data: claim });
  } catch (err) {
    next(err);
  }
});

// POST /api/employee/claims/:id/resubmit — moves a MANAGER_RETURNED claim
// back to SUBMITTED, re-entering the same manager's Approval Queue.
employeeRouter.post("/claims/:id/resubmit", async (req, res, next) => {
  try {
    const claim = await employeeService.resubmitClaim(req, req.user!, req.params.id);
    res.json({ data: claim });
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
