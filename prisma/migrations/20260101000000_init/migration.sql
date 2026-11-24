-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('HOMME', 'FEMME');

-- CreateEnum
CREATE TYPE "MilieuResidence" AS ENUM ('RURAL', 'URBAIN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('BENEFICIAIRE', 'MENTOR', 'EXPERT', 'PARTENAIRE', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MentorshipType" AS ENUM ('INDIVIDUEL', 'COLLECTIF', 'LES_DEUX');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('DOCUMENT', 'LINK', 'VIDEO');

-- CreateEnum
CREATE TYPE "MasterclassStatus" AS ENUM ('UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OpportunityCategory" AS ENUM ('EMPLOI', 'STAGE', 'FORMATION', 'CONCOURS', 'BOURSE', 'FINANCEMENT', 'APPEL_PROJETS', 'EVENEMENT');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DEMANDE', 'ACCEPTATION', 'RENDEZ_VOUS', 'MESSAGE', 'OPPORTUNITE', 'MASTERCLASS', 'ECHEANCE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "supabaseUid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "age" INTEGER,
    "sexe" "Sexe",
    "milieuResidence" "MilieuResidence",
    "situationHandicap" BOOLEAN NOT NULL DEFAULT false,
    "pays" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BENEFICIAIRE',
    "statutCompte" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "consentCgu" BOOLEAN NOT NULL DEFAULT false,
    "consentData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "ville" TEXT,
    "localisation" TEXT,
    "niveauEtude" TEXT,
    "secteurActivite" TEXT,
    "anneesExperience" INTEGER NOT NULL DEFAULT 0,
    "competences" TEXT[],
    "centresInteret" TEXT[],
    "objectifs" TEXT[],
    "langues" TEXT[],
    "disponibilite" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "anneesExperience" INTEGER NOT NULL,
    "expertises" TEXT[],
    "secteurs" TEXT[],
    "langues" TEXT[],
    "publicsAccompagnes" TEXT[],
    "typesMentoring" "MentorshipType" NOT NULL DEFAULT 'INDIVIDUEL',
    "disponibilites" TEXT,
    "biographie" TEXT NOT NULL,
    "photoUrl" TEXT,
    "cvUrl" TEXT,
    "linkedinUrl" TEXT,
    "references" TEXT,
    "statutValidation" "AccountStatus" NOT NULL DEFAULT 'PENDING',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "objectifPrincipal" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "typeAccompagnement" TEXT NOT NULL,
    "competences" TEXT[],
    "besoins" TEXT[],
    "secteur" TEXT NOT NULL,
    "contraintes" TEXT[],
    "disponibilite" TEXT NOT NULL,
    "preferenceMentoring" TEXT NOT NULL,
    "profilBesoin" JSONB,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Diagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingResult" (
    "id" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "detailsScores" JSONB NOT NULL,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchingResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchingWeightConfig" (
    "id" TEXT NOT NULL,
    "expertiseWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.30,
    "objectiveWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "sectorWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "availabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "languageWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "formatWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MatchingWeightConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipRequest" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "objectif" TEXT NOT NULL,
    "problematique" TEXT NOT NULL,
    "duree" TEXT NOT NULL,
    "frequence" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "responseMessage" TEXT,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipProgram" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "progression" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipGoal" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "indicateurs" TEXT,
    "echeance" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipTask" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "goalId" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "echeance" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipResource" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL DEFAULT 'DOCUMENT',
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentorshipResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "specificDate" TIMESTAMP(3),
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorshipSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "slotId" TEXT,
    "mentorId" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "meetingUrl" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "feedbackMentor" TEXT,
    "feedbackMentee" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Masterclass" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "intervenant" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "dateSession" TIMESTAMP(3) NOT NULL,
    "duree" INTEGER NOT NULL,
    "lienLive" TEXT,
    "lienReplay" TEXT,
    "statut" "MasterclassStatus" NOT NULL DEFAULT 'UPCOMING',
    "maxParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Masterclass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterclassRegistration" (
    "id" TEXT NOT NULL,
    "masterclassId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterclassRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "organisation" TEXT NOT NULL,
    "categorie" "OpportunityCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "localisation" TEXT,
    "typeContrat" TEXT,
    "lienCandidature" TEXT NOT NULL,
    "dateExpiration" TIMESTAMP(3) NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityFavorite" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUid_key" ON "User"("supabaseUid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_statutCompte_idx" ON "User"("role", "statutCompte");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_sexe_milieuResidence_situationHandicap_idx" ON "User"("sexe", "milieuResidence", "situationHandicap");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_secteurActivite_idx" ON "UserProfile"("secteurActivite");

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_userId_key" ON "MentorProfile"("userId");

-- CreateIndex
CREATE INDEX "MentorProfile_statutValidation_isAvailable_idx" ON "MentorProfile"("statutValidation", "isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnostic_userId_key" ON "Diagnostic"("userId");

-- CreateIndex
CREATE INDEX "MatchingResult_menteeId_scoreTotal_idx" ON "MatchingResult"("menteeId", "scoreTotal");

-- CreateIndex
CREATE INDEX "MatchingResult_mentorId_idx" ON "MatchingResult"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchingResult_menteeId_mentorId_key" ON "MatchingResult"("menteeId", "mentorId");

-- CreateIndex
CREATE INDEX "MentorshipRequest_mentorId_status_idx" ON "MentorshipRequest"("mentorId", "status");

-- CreateIndex
CREATE INDEX "MentorshipRequest_menteeId_status_idx" ON "MentorshipRequest"("menteeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipProgram_requestId_key" ON "MentorshipProgram"("requestId");

-- CreateIndex
CREATE INDEX "MentorshipProgram_mentorId_status_idx" ON "MentorshipProgram"("mentorId", "status");

-- CreateIndex
CREATE INDEX "MentorshipProgram_menteeId_status_idx" ON "MentorshipProgram"("menteeId", "status");

-- CreateIndex
CREATE INDEX "MentorshipGoal_programId_idx" ON "MentorshipGoal"("programId");

-- CreateIndex
CREATE INDEX "MentorshipTask_programId_status_idx" ON "MentorshipTask"("programId", "status");

-- CreateIndex
CREATE INDEX "MentorshipTask_goalId_idx" ON "MentorshipTask"("goalId");

-- CreateIndex
CREATE INDEX "MentorshipResource_programId_idx" ON "MentorshipResource"("programId");

-- CreateIndex
CREATE INDEX "AvailabilitySlot_mentorId_isActive_idx" ON "AvailabilitySlot"("mentorId", "isActive");

-- CreateIndex
CREATE INDEX "MentorshipSession_mentorId_dateDebut_idx" ON "MentorshipSession"("mentorId", "dateDebut");

-- CreateIndex
CREATE INDEX "MentorshipSession_menteeId_dateDebut_idx" ON "MentorshipSession"("menteeId", "dateDebut");

-- CreateIndex
CREATE INDEX "MentorshipSession_status_idx" ON "MentorshipSession"("status");

-- CreateIndex
CREATE INDEX "Conversation_participant1Id_lastMessageAt_idx" ON "Conversation"("participant1Id", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_participant2Id_lastMessageAt_idx" ON "Conversation"("participant2Id", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_participant1Id_participant2Id_key" ON "Conversation"("participant1Id", "participant2Id");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "Masterclass_dateSession_statut_idx" ON "Masterclass"("dateSession", "statut");

-- CreateIndex
CREATE INDEX "Masterclass_categorie_idx" ON "Masterclass"("categorie");

-- CreateIndex
CREATE INDEX "MasterclassRegistration_userId_idx" ON "MasterclassRegistration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterclassRegistration_masterclassId_userId_key" ON "MasterclassRegistration"("masterclassId", "userId");

-- CreateIndex
CREATE INDEX "Opportunity_status_dateExpiration_idx" ON "Opportunity"("status", "dateExpiration");

-- CreateIndex
CREATE INDEX "Opportunity_categorie_idx" ON "Opportunity"("categorie");

-- CreateIndex
CREATE INDEX "OpportunityFavorite_userId_idx" ON "OpportunityFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityFavorite_opportunityId_userId_key" ON "OpportunityFavorite"("opportunityId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnostic" ADD CONSTRAINT "Diagnostic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingResult" ADD CONSTRAINT "MatchingResult_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchingResult" ADD CONSTRAINT "MatchingResult_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "MentorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipRequest" ADD CONSTRAINT "MentorshipRequest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipRequest" ADD CONSTRAINT "MentorshipRequest_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MentorshipRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipGoal" ADD CONSTRAINT "MentorshipGoal_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipTask" ADD CONSTRAINT "MentorshipTask_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipTask" ADD CONSTRAINT "MentorshipTask_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "MentorshipGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipResource" ADD CONSTRAINT "MentorshipResource_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipSession" ADD CONSTRAINT "MentorshipSession_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterclassRegistration" ADD CONSTRAINT "MasterclassRegistration_masterclassId_fkey" FOREIGN KEY ("masterclassId") REFERENCES "Masterclass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MasterclassRegistration" ADD CONSTRAINT "MasterclassRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityFavorite" ADD CONSTRAINT "OpportunityFavorite_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityFavorite" ADD CONSTRAINT "OpportunityFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
