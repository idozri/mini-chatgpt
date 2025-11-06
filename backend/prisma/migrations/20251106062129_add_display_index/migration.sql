/*
  Warnings:

  - Added the required column `displayIndex` to the `conversations` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "displayIndex" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" DATETIME
);
-- Reason: Populate existing conversations with sequential displayIndex values
-- Assign displayIndex based on creation order (oldest first gets lowest number)
INSERT INTO "new_conversations" ("createdAt", "id", "lastMessageAt", "title", "displayIndex")
SELECT 
    "createdAt", 
    "id", 
    "lastMessageAt", 
    "title",
    (SELECT COUNT(*) + 1 FROM "conversations" c2 WHERE c2."createdAt" < "conversations"."createdAt" OR (c2."createdAt" = "conversations"."createdAt" AND c2."id" < "conversations"."id"))
FROM "conversations"
ORDER BY "createdAt", "id";
DROP TABLE "conversations";
ALTER TABLE "new_conversations" RENAME TO "conversations";
CREATE UNIQUE INDEX "conversations_displayIndex_key" ON "conversations"("displayIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
