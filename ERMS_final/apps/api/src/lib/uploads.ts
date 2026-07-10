import fs from "fs";
import path from "path";

export const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

// Defense in depth: the real guard against path traversal is validating
// claim ownership before this ever runs (see employee/routes.ts's
// requireOwnedDraftClaim), but this refuses to create/return any directory
// that a crafted subdir (e.g. "../../../etc") would resolve outside
// UPLOADS_ROOT, in case that guard is ever bypassed or reused elsewhere.
export function ensureUploadDir(subdir: string): string {
  const dir = path.join(UPLOADS_ROOT, subdir);
  const relative = path.relative(UPLOADS_ROOT, dir);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to create upload directory outside uploads root: ${subdir}`);
  }
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
