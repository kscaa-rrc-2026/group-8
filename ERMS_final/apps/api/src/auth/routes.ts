import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { authenticator } from "otplib";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuthAllowPendingPasswordChange, signAccessToken } from "../middleware/auth";
import { recordAuditLog } from "../middleware/auditLog";
import { ApiError } from "../middleware/errorHandler";
import { passwordSchema } from "../lib/password";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaToken: z.string().optional(),
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password, mfaToken } = loginSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { email } });
    if (!employee || !employee.isActive || employee.deletedAt) {
      throw new ApiError(401, "Invalid credentials");
    }

    const passwordOk = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordOk) {
      throw new ApiError(401, "Invalid credentials");
    }

    if (employee.mfaEnabled) {
      if (!mfaToken) {
        return res.status(401).json({ error: { message: "MFA token required", code: "MFA_REQUIRED" } });
      }
      const mfaOk = authenticator.check(mfaToken, employee.mfaSecret ?? "");
      if (!mfaOk) {
        throw new ApiError(401, "Invalid MFA token");
      }
    }

    const token = signAccessToken({ id: employee.id, role: employee.role, departmentId: employee.departmentId }, employee.passwordChangedAt);

    await prisma.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } });
    await recordAuditLog({ req, action: "LOGIN", entityType: "Employee", entityId: employee.id });

    res.json({
      data: {
        token,
        user: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          departmentId: employee.departmentId,
          mustChangePassword: employee.mustChangePassword,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// POST /api/auth/change-password — self-service, and also what the
// mandatory first-login password change screen calls. Works even while
// req.user.mustChangePassword is true — requireAuth carves out this exact
// path for that reason.
authRouter.post("/change-password", requireAuthAllowPendingPasswordChange, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({ where: { id: req.user!.id } });
    if (!employee) throw new ApiError(404, "Employee not found");

    const currentOk = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!currentOk) throw new ApiError(401, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    // passwordChangedAt invalidates every token issued before this moment
    // (see middleware/auth.ts) — including the one used to make this very
    // request, so the caller will need to log in again afterward too.
    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
    });
    await recordAuditLog({ req, action: "PASSWORD_CHANGE", entityType: "Employee", entityId: employee.id });

    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});

const forgotPasswordSchema = z.object({ email: z.string().email() });
const RESET_TOKEN_TTL_MS = 30 * 60_000;
const FORGOT_PASSWORD_MIN_RESPONSE_MS = 150;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// POST /api/auth/forgot-password — always responds with the same message
// AND after roughly the same amount of time whether or not the email
// exists. The message alone isn't enough: the "existing account" branch
// does genuinely more work (token generation, a DB write, an audit log
// entry), and that extra work is measurable - padding the response to a
// fixed minimum duration closes that timing side-channel rather than just
// hiding it in the wording.
authRouter.post("/forgot-password", async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const employee = await prisma.employee.findUnique({ where: { email } });

    let devOnlyToken: string | undefined;
    if (employee && employee.isActive && !employee.deletedAt) {
      const token = randomBytes(32).toString("hex");
      await prisma.employee.update({
        where: { id: employee.id },
        data: { passwordResetToken: hashToken(token), passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });
      await recordAuditLog({ req, action: "PASSWORD_RESET_REQUEST", entityType: "Employee", entityId: employee.id });
      if (process.env.NODE_ENV !== "production") devOnlyToken = token;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < FORGOT_PASSWORD_MIN_RESPONSE_MS) {
      await new Promise((resolve) => setTimeout(resolve, FORGOT_PASSWORD_MIN_RESPONSE_MS - elapsed));
    }

    res.json({
      data: {
        message: "If that email is registered, a password reset link has been generated.",
        ...(devOnlyToken ? { devOnlyToken } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

const resetPasswordSchema = z.object({ token: z.string().min(1), newPassword: passwordSchema });

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const employee = await prisma.employee.findFirst({
      where: { passwordResetToken: hashToken(token), passwordResetExpiresAt: { gt: new Date() } },
    });
    if (!employee) throw new ApiError(400, "That reset link is invalid or has expired");

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash, mustChangePassword: false, passwordResetToken: null, passwordResetExpiresAt: null, passwordChangedAt: new Date() },
    });
    await recordAuditLog({ req, action: "PASSWORD_RESET_SELF", entityType: "Employee", entityId: employee.id });

    res.json({ data: { success: true } });
  } catch (err) {
    next(err);
  }
});
