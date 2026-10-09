-- CreateTable
CREATE TABLE "PaperListing" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperListing_subjectId_idx" ON "PaperListing"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperListing_paperId_subjectId_key" ON "PaperListing"("paperId", "subjectId");

-- AddForeignKey
ALTER TABLE "PaperListing" ADD CONSTRAINT "PaperListing_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperListing" ADD CONSTRAINT "PaperListing_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

