import { PrismaClient, Role } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
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

  await prisma.employee.upsert({
    where: { email: "admin@erms.local" },
    update: {},
    create: {
      employeeCode: "ADM001",
      name: "Admin User",
      email: "admin@erms.local",
      passwordHash: hashPassword("ChangeMe123!"),
      role: Role.ADMIN,
      departmentId: dept.id,
    },
  });

  const manager = await prisma.employee.upsert({
    where: { email: "manager@erms.local" },
    update: {},
    create: {
      employeeCode: "MGR001",
      name: "Manager User",
      email: "manager@erms.local",
      passwordHash: hashPassword("ChangeMe123!"),
      role: Role.MANAGER,
      departmentId: dept.id,
    },
  });

  await prisma.employee.upsert({
    where: { email: "employee@erms.local" },
    update: {},
    create: {
      employeeCode: "EMP001",
      name: "Employee User",
      email: "employee@erms.local",
      passwordHash: hashPassword("ChangeMe123!"),
      role: Role.EMPLOYEE,
      departmentId: dept.id,
      managerId: manager.id,
    },
  });

  await prisma.employee.upsert({
    where: { email: "accounts@erms.local" },
    update: {},
    create: {
      employeeCode: "ACC001",
      name: "Accounts User",
      email: "accounts@erms.local",
      passwordHash: hashPassword("ChangeMe123!"),
      role: Role.ACCOUNTS,
      departmentId: dept.id,
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
  console.log("  admin@erms.local / manager@erms.local / employee@erms.local / accounts@erms.local");
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
