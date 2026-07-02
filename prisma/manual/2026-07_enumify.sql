-- ステータス系カラムの String → enum 変換（データ保存型）。
-- 既存値は監査済みで全て各enumのラベルに含まれるため、USING キャストで無損失に変換する。
-- 単一トランザクションで実行し、途中失敗時は全ロールバックする。
BEGIN;

-- User.role
CREATE TYPE "Role" AS ENUM ('member', 'admin');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'member';

-- User.choreiStatus / User.lunchStatus（共用 ActivityStatus）
CREATE TYPE "ActivityStatus" AS ENUM ('active', 'inactive');
ALTER TABLE "User" ALTER COLUMN "choreiStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "choreiStatus" TYPE "ActivityStatus" USING ("choreiStatus"::text::"ActivityStatus");
ALTER TABLE "User" ALTER COLUMN "choreiStatus" SET DEFAULT 'active';
ALTER TABLE "User" ALTER COLUMN "lunchStatus" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "lunchStatus" TYPE "ActivityStatus" USING ("lunchStatus"::text::"ActivityStatus");
ALTER TABLE "User" ALTER COLUMN "lunchStatus" SET DEFAULT 'active';

-- User.lunchRole
CREATE TYPE "LunchRole" AS ENUM ('participant', 'organizer');
ALTER TABLE "User" ALTER COLUMN "lunchRole" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "lunchRole" TYPE "LunchRole" USING ("lunchRole"::text::"LunchRole");
ALTER TABLE "User" ALTER COLUMN "lunchRole" SET DEFAULT 'participant';

-- Session.status
CREATE TYPE "SessionStatus" AS ENUM ('scheduled', 'completed', 'cancelled');
ALTER TABLE "Session" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "status" TYPE "SessionStatus" USING ("status"::text::"SessionStatus");
ALTER TABLE "Session" ALTER COLUMN "status" SET DEFAULT 'scheduled';

-- Attendance.status
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'unspoken', 'left_early');
ALTER TABLE "Attendance" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Attendance" ALTER COLUMN "status" TYPE "AttendanceStatus" USING ("status"::text::"AttendanceStatus");
ALTER TABLE "Attendance" ALTER COLUMN "status" SET DEFAULT 'present';

-- AbsenceRequest.type（デフォルトなし）
CREATE TYPE "AbsenceType" AS ENUM ('absent', 'unspoken', 'leave_early');
ALTER TABLE "AbsenceRequest" ALTER COLUMN "type" TYPE "AbsenceType" USING ("type"::text::"AbsenceType");

-- LunchEvent.status（デフォルトなし）
CREATE TYPE "LunchEventStatus" AS ENUM ('planning', 'scheduled', 'completed', 'cancelled');
ALTER TABLE "LunchEvent" ALTER COLUMN "status" TYPE "LunchEventStatus" USING ("status"::text::"LunchEventStatus");

-- Settlement.status（デフォルトなし）
CREATE TYPE "SettlementStatus" AS ENUM ('unpaid', 'paid');
ALTER TABLE "Settlement" ALTER COLUMN "status" TYPE "SettlementStatus" USING ("status"::text::"SettlementStatus");

COMMIT;
