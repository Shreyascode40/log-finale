-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rollNo" TEXT,
    "mobile" TEXT,
    "role" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdVia" TEXT NOT NULL DEFAULT 'SELF_SIGNUP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "groupNo" TEXT,
    "academicYear" TEXT,
    "department" TEXT,
    "projectTitle" TEXT,
    "area" TEXT,
    "guideId" TEXT,
    "creatorId" TEXT NOT NULL,
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "pdfPermission" BOOLEAN NOT NULL DEFAULT false,
    "pdfPermissionBy" TEXT,
    "pdfPermissionAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Group_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Group_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teResult" TEXT,
    "rollNo" TEXT,
    "examSeatNo" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "contribution" TEXT,
    "photoUrl" TEXT,
    "memberType" TEXT NOT NULL DEFAULT 'member',
    "rulesAckAt" DATETIME,
    "undertakingAcceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "invitedRollNo" TEXT,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "topicNo" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "significance" INTEGER,
    "innovativeness" INTEGER,
    "scope" INTEGER,
    "feasibility" INTEGER,
    "guideRecommendation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TopicProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopicProposal_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT,
    "note" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "text" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ActivityEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "statusText" TEXT,
    "studentConfirmedAt" DATETIME,
    "studentConfirmedById" TEXT,
    "guideVerifiedAt" DATETIME,
    "guideVerifiedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActivityEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ActivityTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActivityEntry_studentConfirmedById_fkey" FOREIGN KEY ("studentConfirmedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ActivityEntry_guideVerifiedById_fkey" FOREIGN KEY ("guideVerifiedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityEntryHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entryId" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    CONSTRAINT "ActivityEntryHistory_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ActivityEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityEntryHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "richText" TEXT,
    "fileUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "hasDateColumn" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "ReviewQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "questionNo" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "ReviewQuestion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReviewTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "remarkAndSuggestions" TEXT,
    "guideId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "submittedAt" DATETIME,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "unlockReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewForm_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewForm_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReviewTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReviewForm_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReviewForm_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "remark" TEXT,
    "grade" TEXT,
    "guideSignedAt" DATETIME,
    "guideSignedById" TEXT,
    CONSTRAINT "ReviewScore_formId_fkey" FOREIGN KEY ("formId") REFERENCES "ReviewForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewScore_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ReviewQuestion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewScore_guideSignedById_fkey" FOREIGN KEY ("guideSignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarksSheet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "components" TEXT NOT NULL DEFAULT '{}',
    "total" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "guideId" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "unlockReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarksSheet_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarksSheet_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarksSheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExaminerFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "answers" TEXT NOT NULL DEFAULT '[]',
    "remarks" TEXT,
    "projectTitle" TEXT,
    "date" TEXT,
    "externalName" TEXT,
    "internalName" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminerFeedback_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "items" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Checklist_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT,
    "collegeAndLevel" TEXT,
    "type" TEXT,
    "award" TEXT,
    "certificateUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competition_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaperPublication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "conference" TEXT,
    "issn" TEXT,
    "volIssue" TEXT,
    "pageNo" TEXT,
    "fileUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaperPublication_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SponsoredMeeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "date" TEXT,
    "summaryPrev" TEXT,
    "summaryNext" TEXT,
    "studentSignedAt" DATETIME,
    "guideSignedAt" DATETIME,
    "externalGuideSignedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SponsoredMeeting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SponsorFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "company" TEXT,
    "ratings" TEXT NOT NULL DEFAULT '{}',
    "sealUrl" TEXT,
    "signedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SponsorFeedback_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PdfExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "generatedById" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileUrl" TEXT NOT NULL,
    CONSTRAINT "PdfExport_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PdfExport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_rollNo_key" ON "User"("rollNo");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_code_key" ON "Group"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupInvite_groupId_idx" ON "GroupInvite"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicProposal_groupId_topicNo_key" ON "TopicProposal"("groupId", "topicNo");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_term_sortOrder_key" ON "ScheduleItem"("term", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_month_sortOrder_key" ON "ActivityTemplate"("month", "sortOrder");

-- CreateIndex
CREATE INDEX "ActivityEntry_groupId_month_idx" ON "ActivityEntry"("groupId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityEntry_groupId_templateId_key" ON "ActivityEntry"("groupId", "templateId");

-- CreateIndex
CREATE INDEX "ActivityEntryHistory_entryId_idx" ON "ActivityEntryHistory"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_groupId_type_sortOrder_key" ON "ContentPage"("groupId", "type", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTemplate_reviewType_key" ON "ReviewTemplate"("reviewType");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestion_templateId_questionNo_key" ON "ReviewQuestion"("templateId", "questionNo");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewForm_groupId_templateId_key" ON "ReviewForm"("groupId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewScore_formId_questionId_key" ON "ReviewScore"("formId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarksSheet_groupId_memberId_kind_key" ON "MarksSheet"("groupId", "memberId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminerFeedback_groupId_term_key" ON "ExaminerFeedback"("groupId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Checklist_groupId_term_key" ON "Checklist"("groupId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredMeeting_groupId_semester_sortOrder_key" ON "SponsoredMeeting"("groupId", "semester", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SponsorFeedback_groupId_key" ON "SponsorFeedback"("groupId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
