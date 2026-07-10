import { Router } from "express";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signAccessToken } from "../middleware/auth";
import { recordAuditLog } from "../middleware/auditLog";
import { ApiError } from "../middleware/errorHandler";

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

    const token = signAccessToken({ id: employee.id, role: employee.role, departmentId: employee.departmentId });

    await prisma.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date() } });
    await recordAuditLog({ req, action: "LOGIN", entityType: "Employee", entityId: employee.id });

    res.json({
      data: {
        token,
        user: { id: employee.id, name: employee.name, email: employee.email, role: employee.role, departmentId: employee.departmentId },
      },
    });
  } catch (err) {
    next(err);
  }
});
