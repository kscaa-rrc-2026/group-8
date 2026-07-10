import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Mount last, after all routes. Route handlers should throw ApiError (or
// let Zod throw on bad input) rather than building their own error JSON.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { message: "Validation failed", code: "VALIDATION_ERROR", details: err.flatten() } });
  }
  console.error(err);
  return res.status(500).json({ error: { message: "Internal server error" } });
}
