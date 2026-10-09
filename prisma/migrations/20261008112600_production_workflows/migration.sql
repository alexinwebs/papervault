-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "examClassification" TEXT NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;

-- AlterTable
ALTER TABLE "TakedownRequest" ADD COLUMN     "reviewRequest" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "statusUntil" TIMESTAMP(3),
ADD COLUMN     "teacherVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TeacherVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activeKey" TEXT,
    "fullName" TEXT NOT NULL,
    "collegeId" TEXT,
    "institutionName" TEXT NOT NULL,
    "university" TEXT,
    "department" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "subjectsTaught" TEXT NOT NULL,
    "institutionalEmail" TEXT,
    "employeeId" TEXT,
    "verificationNotes" TEXT,
    "infoRequested" TEXT,
    "adminNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherVerificationDocument" (
    "id" TEXT NOT NULL,
    "verificationRequestId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "detectedMimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'CLEAN',
    "scanEngine" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "retentionStatus" TEXT NOT NULL DEFAULT 'RETAINED',
    "deleteAfter" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherVerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherVerificationEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCounter" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketCounter_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "assigneeId" TEXT,
    "relatedPaperId" TEXT,
    "relatedCommentId" TEXT,
    "relatedUserId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "clientToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT,
    "uploadedById" TEXT,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAssignment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollegeRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "website" TEXT,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdCollegeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollegeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectRequest" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "programId" TEXT,
    "branchId" TEXT,
    "semesterId" TEXT,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "decisionNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdSubjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherVerificationRequest_activeKey_key" ON "TeacherVerificationRequest"("activeKey");

-- CreateIndex
CREATE INDEX "TeacherVerificationRequest_userId_createdAt_idx" ON "TeacherVerificationRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TeacherVerificationRequest_status_createdAt_idx" ON "TeacherVerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherVerificationDocument_storageKey_key" ON "TeacherVerificationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "TeacherVerificationDocument_verificationRequestId_idx" ON "TeacherVerificationDocument"("verificationRequestId");

-- CreateIndex
CREATE INDEX "TeacherVerificationDocument_retentionStatus_deleteAfter_idx" ON "TeacherVerificationDocument"("retentionStatus", "deleteAfter");

-- CreateIndex
CREATE INDEX "TeacherVerificationEvent_requestId_createdAt_idx" ON "TeacherVerificationEvent"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterId_lastActivityAt_idx" ON "SupportTicket"("requesterId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_lastActivityAt_idx" ON "SupportTicket"("status", "priority", "lastActivityAt");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketMessage_ticketId_clientToken_key" ON "TicketMessage"("ticketId", "clientToken");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAttachment_storageKey_key" ON "TicketAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "TicketAttachment_ticketId_idx" ON "TicketAttachment"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAssignment_ticketId_createdAt_idx" ON "TicketAssignment"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_createdAt_idx" ON "TicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeRequest_ticketId_key" ON "CollegeRequest"("ticketId");

-- CreateIndex
CREATE INDEX "CollegeRequest_status_createdAt_idx" ON "CollegeRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectRequest_ticketId_key" ON "SubjectRequest"("ticketId");

-- CreateIndex
CREATE INDEX "SubjectRequest_status_createdAt_idx" ON "SubjectRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SubjectRequest_collegeId_idx" ON "SubjectRequest"("collegeId");

-- CreateIndex
CREATE INDEX "UserReport_reportedUserId_status_idx" ON "UserReport"("reportedUserId", "status");

-- CreateIndex
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- AddForeignKey
ALTER TABLE "TeacherVerificationRequest" ADD CONSTRAINT "TeacherVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherVerificationRequest" ADD CONSTRAINT "TeacherVerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherVerificationRequest" ADD CONSTRAINT "TeacherVerificationRequest_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherVerificationDocument" ADD CONSTRAINT "TeacherVerificationDocument_verificationRequestId_fkey" FOREIGN KEY ("verificationRequestId") REFERENCES "TeacherVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherVerificationEvent" ADD CONSTRAINT "TeacherVerificationEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TeacherVerificationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketAssignment" ADD CONSTRAINT "TicketAssignment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeRequest" ADD CONSTRAINT "CollegeRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeRequest" ADD CONSTRAINT "CollegeRequest_createdCollegeId_fkey" FOREIGN KEY ("createdCollegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_createdSubjectId_fkey" FOREIGN KEY ("createdSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing bans become BANNED standing; papers that are already
-- public were released before this field existed.
UPDATE "User" SET "status" = 'BANNED', "statusReason" = "banReason" WHERE "bannedAt" IS NOT NULL;
UPDATE "Paper" SET "examClassification" = 'PAST' WHERE "status" = 'PUBLISHED';

-- Integrity: the database refuses states the application does not know about.
ALTER TABLE "User" ADD CONSTRAINT "User_status_check"
  CHECK ("status" IN ('ACTIVE','WARNED','RESTRICTED','SUSPENDED','BANNED'));
ALTER TABLE "User" ADD CONSTRAINT "User_role_check"
  CHECK ("role" IN ('STUDENT','TEACHER','MODERATOR','COLLEGE_ADMIN','PLATFORM_ADMIN'));
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_examClassification_check"
  CHECK ("examClassification" IN ('CURRENT','UPCOMING','PAST','RELEASED','UNKNOWN'));
ALTER TABLE "TeacherVerificationRequest" ADD CONSTRAINT "TeacherVerificationRequest_status_check"
  CHECK ("status" IN ('PENDING','UNDER_REVIEW','NEEDS_MORE_INFORMATION','APPROVED','REJECTED','CANCELLED','REVOKED'));
-- activeKey is set exactly while the request is open.
ALTER TABLE "TeacherVerificationRequest" ADD CONSTRAINT "TeacherVerificationRequest_activeKey_check"
  CHECK (("status" IN ('PENDING','UNDER_REVIEW','NEEDS_MORE_INFORMATION')) = ("activeKey" IS NOT NULL AND "activeKey" = "userId"));
ALTER TABLE "TeacherVerificationDocument" ADD CONSTRAINT "TeacherVerificationDocument_retention_check"
  CHECK ("retentionStatus" IN ('RETAINED','SCHEDULED_FOR_DELETION','DELETED'));
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_status_check"
  CHECK ("status" IN ('OPEN','IN_REVIEW','WAITING_FOR_USER','WAITING_FOR_ADMIN','RESOLVED','CLOSED'));
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_priority_check"
  CHECK ("priority" IN ('LOW','NORMAL','HIGH','URGENT'));
ALTER TABLE "CollegeRequest" ADD CONSTRAINT "CollegeRequest_status_check"
  CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','NEEDS_INFORMATION'));
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_status_check"
  CHECK ("status" IN ('REQUESTED','APPROVED','REJECTED','NEEDS_INFORMATION'));
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_status_check"
  CHECK ("status" IN ('OPEN','RESOLVED','DISMISSED'));
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_not_self_check"
  CHECK ("reportedUserId" <> "reportedById");

-- Audit records are append-only. The only permitted change is the actor
-- reference going NULL (FK SET NULL when an account row is removed). Deleting
-- rows requires an explicit, transaction-local opt-in used solely by the
-- development-data purge script.
CREATE OR REPLACE FUNCTION papervault_audit_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('papervault.allow_audit_delete', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'AuditLog rows are immutable';
  END IF;
  IF NEW."id" = OLD."id" AND NEW."action" = OLD."action" AND NEW."entityType" = OLD."entityType"
     AND NEW."entityId" = OLD."entityId" AND NEW."before" IS NOT DISTINCT FROM OLD."before"
     AND NEW."after" IS NOT DISTINCT FROM OLD."after" AND NEW."reason" IS NOT DISTINCT FROM OLD."reason"
     AND NEW."createdAt" = OLD."createdAt" AND NEW."actorId" IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'AuditLog rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_immutable"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION papervault_audit_immutable();
