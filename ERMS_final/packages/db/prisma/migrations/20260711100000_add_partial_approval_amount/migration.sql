-- AlterTable
ALTER TABLE "ApprovalStep" ADD COLUMN     "approvedAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "approvedAmount" DECIMAL(12,2);
