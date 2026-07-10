import { prisma } from "../../lib/prisma";

export async function employeeWiseReport() {
  return prisma.claim.groupBy({
    by: ["employeeId"],
    where: { deletedAt: null },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
}

export async function departmentWiseReport() {
  return prisma.claim.groupBy({
    by: ["departmentId"],
    where: { deletedAt: null },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
}

// month = "2026-07"
export async function monthlyReport(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return prisma.claim.findMany({
    where: { deletedAt: null, createdAt: { gte: start, lt: end } },
    include: { employee: true, department: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function paymentReport() {
  return prisma.payment.findMany({
    include: { claim: { include: { employee: true } }, processedBy: true },
    orderBy: { paidAt: "desc" },
  });
}

export async function rejectedReport() {
  return prisma.claim.findMany({
    where: { deletedAt: null, status: { in: ["MANAGER_REJECTED", "ACCOUNTS_REJECTED"] } },
    include: { employee: true, department: true, approvalSteps: true },
    orderBy: { updatedAt: "desc" },
  });
}

// Minimal, dependency-free CSV export — good enough for flat report rows.
// TODO: Excel export (exceljs) and PDF export (pdfkit) — add them to
// apps/api/package.json and follow this same "rows in, buffer/string out"
// shape so routes.ts doesn't need to change per format.
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))];
  return lines.join("\n");
}
