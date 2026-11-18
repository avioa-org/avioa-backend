-- CreateTable
CREATE TABLE "commercial_operators" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "raw" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_operators_pkey" PRIMARY KEY ("id")
);
