import { prisma } from "../../lib/prisma";

export { toCsv } from "../../lib/csv";

// Every report returns flat, CSV/table-friendly rows (no nested objects) -
// toCsv() only knows how to stringify scalars, and a raw Prisma relation
// object would otherwise render as "[object Object]".

export async function employeeWiseReport() {
  const grouped = await prisma.claim.groupBy({
    by: ["employeeId"],
    where: { deletedAt: null },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const employees = await prisma.employee.findMany({
    where: { id: { in: grouped.map((g) => g.employeeId) } },
    select: { id: true, name: true, employeeCode: true },
  });
  const byId = new Map(employees.map((e) => [e.id, e]));
  return grouped.map((g) => ({
    employeeCode: byId.get(g.employeeId)?.employeeCode ?? g.employeeId,
    employeeName: byId.get(g.employeeId)?.name ?? "Unknown",
    claimCount: g._count._all,
    totalAmount: g._sum.totalAmount,
  }));
}

export async function departmentWiseReport() {
  const grouped = await prisma.claim.groupBy({
    by: ["departmentId"],
    where: { deletedAt: null },
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const departments = await prisma.department.findMany({
    where: { id: { in: grouped.map((g) => g.departmentId) } },
    select: { id: true, name: true, code: true },
  });
  const byId = new Map(departments.map((d) => [d.id, d]));
  return grouped.map((g) => ({
    departmentCode: byId.get(g.departmentId)?.code ?? g.departmentId,
    departmentName: byId.get(g.departmentId)?.name ?? "Unknown",
    claimCount: g._count._all,
    totalAmount: g._sum.totalAmount,
  }));
}

// month = "2026-07". Boundaries computed in UTC to match how Prisma/Postgres
// store createdAt - using server-local time here would shift the range by
// the server's UTC offset, clipping or duplicating claims near month edges.
export async function monthlyReport(month: string) {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 1));
  const claims = await prisma.claim.findMany({
    where: { deletedAt: null, createdAt: { gte: start, lt: end } },
    include: { employee: true, department: true },
    orderBy: { createdAt: "asc" },
  });
  return claims.map((c) => ({
    claimNumber: c.claimNumber,
    employeeName: c.employee.name,
    departmentName: c.department.name,
    status: c.status,
    totalAmount: c.totalAmount,
    submittedAt: c.submittedAt,
  }));
}

export async function paymentReport() {
  const payments = await prisma.payment.findMany({
    include: { claim: { include: { employee: true } }, processedBy: true },
    orderBy: { paidAt: "desc" },
  });
  return payments.map((p) => ({
    claimNumber: p.claim.claimNumber,
    employeeName: p.claim.employee.name,
    amount: p.amount,
    paymentMode: p.paymentMode,
    transactionRef: p.transactionRef,
    processedByName: p.processedBy.name,
    paidAt: p.paidAt,
  }));
}

export async function rejectedReport() {
  const claims = await prisma.claim.findMany({
    where: { deletedAt: null, status: { in: ["MANAGER_REJECTED", "ACCOUNTS_REJECTED"] } },
    include: { employee: true, department: true, approvalSteps: true },
    orderBy: { updatedAt: "desc" },
  });
  return claims.map((c) => ({
    claimNumber: c.claimNumber,
    employeeName: c.employee.name,
    departmentName: c.department.name,
    status: c.status,
    totalAmount: c.totalAmount,
    remarks: c.approvalSteps[c.approvalSteps.length - 1]?.remarks ?? "",
  }));
}

// TODO: Excel export (exceljs) and PDF export (pdfkit) — add them to
// apps/api/package.json and follow toCsv's "rows in, string out" shape so
// routes.ts doesn't need to change per format.
