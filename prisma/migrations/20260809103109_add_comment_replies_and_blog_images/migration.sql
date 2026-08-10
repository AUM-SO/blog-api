-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "parentId" INTEGER;

-- CreateTable
CREATE TABLE "blog_images" (
    "id" SERIAL NOT NULL,
    "blogId" INTEGER NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "isCover" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blog_images_blogId_idx" ON "blog_images"("blogId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- AddForeignKey
ALTER TABLE "blog_images" ADD CONSTRAINT "blog_images_blogId_fkey" FOREIGN KEY ("blogId") REFERENCES "blogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
