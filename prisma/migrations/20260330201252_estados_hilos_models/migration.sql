-- CreateTable
CREATE TABLE "estados_hilos" (
    "thread_id" TEXT NOT NULL,
    "ultimo_mensaje" INTEGER,
    "estado" TEXT,
    "ultima_revision" TIMESTAMP(3),

    CONSTRAINT "estados_hilos_pkey" PRIMARY KEY ("thread_id")
);
