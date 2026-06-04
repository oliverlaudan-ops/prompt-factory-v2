-- CreateTable
CREATE TABLE "Refinement" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "refinedText" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "instruction" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refinement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refinement_promptId_createdAt_idx" ON "Refinement"("promptId", "createdAt");

-- AddForeignKey
ALTER TABLE "Refinement" ADD CONSTRAINT "Refinement_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
