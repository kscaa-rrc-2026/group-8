import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Must match the hashing scheme apps/api/src/auth/routes.ts verifies
// against (bcrypt.compare) and apps/api/src/modules/admin/service.ts uses
// for new employees.
function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

async function main() {
  const dept = await prisma.department.upsert({
    where: { code: "ENG" },
    update: {},
    create: { name: "Engineering", code: "ENG", costCenter: "CC-100" },
  });

  await prisma.expenseCategory.upsert({
    where: { name: "Travel" },
    update: {},
    create: { name: "Travel", requiresBill: true, maxAmount: 25000 },
  });
  await prisma.expenseCategory.upsert({
    where: { name: "Food" },
    update: {},
    create: { name: "Food", requiresBill: true, maxAmount: 2000 },
  });
  await prisma.expenseCategory.upsert({
    where: { name: "Office Supplies" },
    update: {},
    create: { name: "Office Supplies", requiresBill: true, maxAmount: 5000 },
  });
  await prisma.expenseCategory.upsert({
    where: { name: "Other" },
    update: {},
    create: { name: "Other", requiresBill: true, maxAmount: null },
  });

  const seedPasswordHash = hashPassword("ChangeMe123!");

  // Every employee needs a manager assigned except CEO, who is the top of
  // the org chart and the only role allowed to approve their own claim.
  const ceo = await prisma.employee.upsert({
    where: { email: "ceo@erms.local" },
    update: { passwordHash: seedPasswordHash, mustChangePassword: false },
    create: {
      employeeCode: "CEO001",
      name: "CEO User",
      email: "ceo@erms.local",
      passwordHash: seedPasswordHash,
      role: Role.CEO,
      departmentId: dept.id,
      mustChangePassword: false,
    },
  });

  await prisma.employee.upsert({
    where: { email: "admin@erms.local" },
    update: { passwordHash: seedPasswordHash, managerId: ceo.id, mustChangePassword: false },
    create: {
      employeeCode: "ADM001",
      name: "Admin User",
      email: "admin@erms.local",
      passwordHash: seedPasswordHash,
      role: Role.ADMIN,
      departmentId: dept.id,
      managerId: ceo.id,
      mustChangePassword: false,
    },
  });

  const manager = await prisma.employee.upsert({
    where: { email: "manager@erms.local" },
    update: { passwordHash: seedPasswordHash, managerId: ceo.id, mustChangePassword: false },
    create: {
      employeeCode: "MGR001",
      name: "Manager User",
      email: "manager@erms.local",
      passwordHash: seedPasswordHash,
      role: Role.MANAGER,
      departmentId: dept.id,
      managerId: ceo.id,
      mustChangePassword: false,
    },
  });

  await prisma.employee.upsert({
    where: { email: "employee@erms.local" },
    update: { passwordHash: seedPasswordHash, managerId: manager.id, mustChangePassword: false },
    create: {
      employeeCode: "EMP001",
      name: "Employee User",
      email: "employee@erms.local",
      passwordHash: seedPasswordHash,
      role: Role.EMPLOYEE,
      departmentId: dept.id,
      managerId: manager.id,
      mustChangePassword: false,
    },
  });

  await prisma.employee.upsert({
    where: { email: "accounts@erms.local" },
    update: { passwordHash: seedPasswordHash, managerId: ceo.id, mustChangePassword: false },
    create: {
      employeeCode: "ACC001",
      name: "Accounts User",
      email: "accounts@erms.local",
      passwordHash: seedPasswordHash,
      role: Role.ACCOUNTS,
      departmentId: dept.id,
      managerId: ceo.id,
      mustChangePassword: false,
    },
  });

  await prisma.approvalMatrix.upsert({
    where: { id: "seed-matrix-1" },
    update: {},
    create: {
      id: "seed-matrix-1",
      departmentId: dept.id,
      minAmount: 0,
      maxAmount: 10000,
      sequence: 1,
      approverRole: Role.MANAGER,
    },
  });
  await prisma.approvalMatrix.upsert({
    where: { id: "seed-matrix-2" },
    update: {},
    create: {
      id: "seed-matrix-2",
      departmentId: dept.id,
      minAmount: 10000.01,
      maxAmount: 999999,
      sequence: 2,
      approverRole: Role.ADMIN,
    },
  });

  console.log("Seed complete:");
  console.log("  ceo@erms.local / admin@erms.local / manager@erms.local / employee@erms.local / accounts@erms.local");
  console.log("  password: ChangeMe123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
