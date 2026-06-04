-- CreateTable
CREATE TABLE "UserOllamaConfig" (
    "userId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "keyIv" TEXT NOT NULL,
    "keyAuthTag" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL DEFAULT 'minimax-m3:cloud',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOllamaConfig_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserOllamaConfig" ADD CONSTRAINT "UserOllamaConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
