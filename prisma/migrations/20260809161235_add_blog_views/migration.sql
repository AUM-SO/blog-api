-- CreateTable
CREATE TABLE "blog_views" (
    "blogId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_views_pkey" PRIMARY KEY ("blogId","userId")
);

-- CreateIndex
CREATE INDEX "blog_views_userId_idx" ON "blog_views"("userId");

-- AddForeignKey
ALTER TABLE "blog_views" ADD CONSTRAINT "blog_views_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_views" ADD CONSTRAINT "blog_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
