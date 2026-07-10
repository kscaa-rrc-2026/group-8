import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: Role;
  departmentId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: { message: string; code?: string };
}
