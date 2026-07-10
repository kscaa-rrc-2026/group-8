// Every place an Employee gets nested into another response (a claim's
// employee, an employee's manager, the employee list itself) must use this
// instead of `include: { employee: true }` / `manager: true` - a bare
// include returns every column, including passwordHash, mfaSecret, and
// passwordResetToken. Never widen this without a specific reason.
export const SAFE_EMPLOYEE_SELECT = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  managerId: true,
  isActive: true,
  mfaEnabled: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} as const;
