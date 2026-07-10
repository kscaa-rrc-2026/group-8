import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../types";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-secret-change-me";
const IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MIN ?? 20) * 60_000;

interface AccessTokenPayload extends AuthUser {
  // Timestamp (ms) of Employee.passwordChangedAt at the moment this token
  // was issued. Checked against the current DB value on every request so a
  // password change actually invalidates tokens issued before it - without
  // this, a stolen token keeps working after the legitimate user "changes
  // their password", since a JWT has no other revocation mechanism.
  pcat: number;
}

// Verifies the JWT, then enforces a genuinely rolling idle-session timeout
// against Employee.lastActiveAt in the database. This can NOT live inside
// the JWT itself: a JWT is immutable once signed, so a timestamp baked into
// it at login can never reflect actual subsequent activity - it would just
// be a second, redundant expiry fixed at login time. ACCESS_TOKEN_TTL_MIN
// is deliberately set well above SESSION_IDLE_TIMEOUT_MIN (see .env.example)
// so this idle check - not the JWT's own exp - is what actually governs
// session length for an active user.
//
// Also enforces the mandatory first-login/post-reset password change: any
// employee with mustChangePassword still set gets 403'd off every route
// except POST /api/auth/change-password, which uses
// requireAuthAllowPendingPasswordChange instead of this to let them
// actually fix it.
async function authenticate(req: Request, res: Response, next: NextFunction, allowPendingPasswordChange: boolean) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Missing bearer token" } });
  }

  try {
    const payload = jwt.verify(header.slice(7), ACCESS_SECRET) as AccessTokenPayload;

    const employee = await prisma.employee.findUnique({
      where: { id: payload.id },
      select: { isActive: true, deletedAt: true, lastActiveAt: true, mustChangePassword: true, passwordChangedAt: true },
    });
    if (!employee || !employee.isActive || employee.deletedAt) {
      return res.status(401).json({ error: { message: "Account is no longer active" } });
    }

    if (payload.pcat !== employee.passwordChangedAt.getTime()) {
      return res.status(401).json({ error: { message: "Your password was changed - please log in again", code: "PASSWORD_CHANGED" } });
    }

    if (employee.lastActiveAt && Date.now() - employee.lastActiveAt.getTime() > IDLE_TIMEOUT_MS) {
      return res.status(401).json({ error: { message: "Session expired due to inactivity", code: "SESSION_TIMEOUT" } });
    }

    if (employee.mustChangePassword && !allowPendingPasswordChange) {
      return res.status(403).json({ error: { message: "You must change your password before continuing", code: "MUST_CHANGE_PASSWORD" } });
    }

    await prisma.employee.update({ where: { id: payload.id }, data: { lastActiveAt: new Date() } });

    req.user = { id: payload.id, role: payload.role, departmentId: payload.departmentId };
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: { message: "Invalid or expired token" } });
    }
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next, false);
}

// Used only by POST /api/auth/change-password - the one route someone with
// a pending mandatory password change must still be able to reach.
export function requireAuthAllowPendingPasswordChange(req: Request, res: Response, next: NextFunction) {
  return authenticate(req, res, next, true);
}

export function signAccessToken(user: AuthUser, passwordChangedAt: Date): string {
  const expiresInSeconds = Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 480) * 60;
  const payload: AccessTokenPayload = { ...user, pcat: passwordChangedAt.getTime() };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: expiresInSeconds });
}
