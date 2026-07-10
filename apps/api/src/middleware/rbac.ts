import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

// Server-side role gate. The frontend hiding a button is a UX nicety, not
// access control — every mutating/sensitive route must also call this.
export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: { message: `Requires role: ${allowed.join(", ")}` } });
    }
    next();
  };
}
