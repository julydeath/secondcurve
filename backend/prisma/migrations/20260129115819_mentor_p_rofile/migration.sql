-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "currentCompany" TEXT,
ADD COLUMN     "currentTitle" TEXT,
ADD COLUMN     "linkedinHeadline" TEXT,
ADD COLUMN     "linkedinIndustry" TEXT,
ADD COLUMN     "linkedinLocation" TEXT,
ADD COLUMN     "linkedinRaw" JSONB,
ADD COLUMN     "linkedinUrl" TEXT;
