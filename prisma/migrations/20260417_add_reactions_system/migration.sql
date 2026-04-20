-- Create ReactionType enum if not exists
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

-- Create Reaction model table
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- Add reactionsCount columns if they don't exist
ALTER TABLE "posts" ADD COLUMN "reactionsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "comments" ADD COLUMN "reactionsCount" INTEGER NOT NULL DEFAULT 0;

-- Create unique constraints
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_postId_key" UNIQUE("userId", "postId");
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_commentId_key" UNIQUE("userId", "commentId");

-- Create indexes
CREATE INDEX "reactions_userId_idx" ON "reactions"("userId");
CREATE INDEX "reactions_type_idx" ON "reactions"("type");

-- Add foreign keys
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE;
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE;
