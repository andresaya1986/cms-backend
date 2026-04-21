-- CreateTable
CREATE TABLE "hashtags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "trendingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hashtag_posts" (
    "hashtagId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtag_posts_pkey" PRIMARY KEY ("hashtagId","postId")
);

-- CreateTable
CREATE TABLE "hashtag_comments" (
    "hashtagId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtag_comments_pkey" PRIMARY KEY ("hashtagId","commentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_name_key" ON "hashtags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_slug_key" ON "hashtags"("slug");

-- CreateIndex
CREATE INDEX "hashtags_name_idx" ON "hashtags"("name");

-- CreateIndex
CREATE INDEX "hashtags_count_idx" ON "hashtags"("count");

-- CreateIndex
CREATE INDEX "hashtags_trendingScore_idx" ON "hashtags"("trendingScore");

-- CreateIndex
CREATE INDEX "hashtags_createdAt_idx" ON "hashtags"("createdAt");

-- CreateIndex
CREATE INDEX "hashtag_posts_postId_idx" ON "hashtag_posts"("postId");

-- CreateIndex
CREATE INDEX "hashtag_posts_hashtagId_idx" ON "hashtag_posts"("hashtagId");

-- CreateIndex
CREATE INDEX "hashtag_comments_commentId_idx" ON "hashtag_comments"("commentId");

-- CreateIndex
CREATE INDEX "hashtag_comments_hashtagId_idx" ON "hashtag_comments"("hashtagId");

-- AddForeignKey
ALTER TABLE "hashtag_posts" ADD CONSTRAINT "hashtag_posts_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hashtag_posts" ADD CONSTRAINT "hashtag_posts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hashtag_comments" ADD CONSTRAINT "hashtag_comments_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hashtag_comments" ADD CONSTRAINT "hashtag_comments_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
