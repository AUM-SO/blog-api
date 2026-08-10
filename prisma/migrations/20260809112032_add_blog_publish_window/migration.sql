-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "publishedFrom" TIMESTAMP(3),
ADD COLUMN     "publishedUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "blogs_publishedFrom_publishedUntil_idx" ON "blogs"("publishedFrom", "publishedUntil");
