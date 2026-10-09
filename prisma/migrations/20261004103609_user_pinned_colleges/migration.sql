-- CreateTable
CREATE TABLE "UserPinnedCollege" (
    "userId" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPinnedCollege_pkey" PRIMARY KEY ("userId","collegeId")
);

-- CreateIndex
CREATE INDEX "UserPinnedCollege_userId_createdAt_idx" ON "UserPinnedCollege"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserPinnedCollege_collegeId_idx" ON "UserPinnedCollege"("collegeId");

-- AddForeignKey
ALTER TABLE "UserPinnedCollege" ADD CONSTRAINT "UserPinnedCollege_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPinnedCollege" ADD CONSTRAINT "UserPinnedCollege_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE CASCADE ON UPDATE CASCADE;
