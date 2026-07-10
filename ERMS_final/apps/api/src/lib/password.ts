import { z } from "zod";

// Shown to the user alongside every password field (create employee,
// change password, reset password) - keep this in sync with passwordSchema
// below, they must describe the exact same rule.
export const PASSWORD_RULES_TEXT = [
  "At least 8 characters",
  "At least one uppercase letter (A-Z)",
  "At least one lowercase letter (a-z)",
  "At least one number (0-9)",
  "At least one special character (e.g. ! @ # $ % ^ & *)",
];

// Reused by every endpoint that sets a password - never re-validate
// strength ad hoc per module.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
