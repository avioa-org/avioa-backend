-- CreateTable
CREATE TABLE "knowledge_folder" (
    "knowledge_folder_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_folder_pkey" PRIMARY KEY ("knowledge_folder_id")
);

-- CreateTable
CREATE TABLE "knowledge_file" (
    "knowledge_file_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "drive_url" TEXT NOT NULL,
    "folder_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_file_pkey" PRIMARY KEY ("knowledge_file_id")
);

-- CreateIndex
CREATE INDEX "knowledge_folder_parentId_idx" ON "knowledge_folder"("parentId");

-- CreateIndex
CREATE INDEX "knowledge_file_folder_id_idx" ON "knowledge_file"("folder_id");

-- AddForeignKey
ALTER TABLE "knowledge_folder" ADD CONSTRAINT "knowledge_folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "knowledge_folder"("knowledge_folder_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_folder" ADD CONSTRAINT "knowledge_folder_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_file" ADD CONSTRAINT "knowledge_file_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "knowledge_folder"("knowledge_folder_id") ON DELETE CASCADE ON UPDATE CASCADE;
