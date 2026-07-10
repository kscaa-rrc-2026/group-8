import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthUser } from "../types";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "dev-secret-change-me";
const IDLE_TIMEOUT_MS = Number(process.env.SESSION_IDLE_TIMEOUT_MIN ?? 20) * 60_000;

interface AccessTokenPayload extends AuthUser {
  lastActiveAt: number;
}

// Verifies the JWT and additionally enforces a rolling idle-session timeout:
// a technically-valid token is still rejected once it's gone stale, so an
// unattended browser tab doesn't stay authenticated indefinitely.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Missing bearer token" } });
  }

  try {
    const payload = jwt.verify(header.slice(7), ACCESS_SECRET) as AccessTokenPayload;

    if (Date.now() - payload.lastActiveAt > IDLE_TIMEOUT_MS) {
      return res.status(401).json({ error: { message: "Session expired due to inactivity", code: "SESSION_TIMEOUT" } });
    }

    req.user = { id: payload.id, role: payload.role, departmentId: payload.departmentId };
    next();
  } catch {
    return res.status(401).json({ error: { message: "Invalid or expired token" } });
  }
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = { ...user, lastActiveAt: Date.now() };
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: `${process.env.ACCESS_TOKEN_TTL_MIN ?? 15}m` });
}
