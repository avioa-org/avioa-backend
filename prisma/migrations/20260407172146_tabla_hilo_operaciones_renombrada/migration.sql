/*
  Warnings:

  - You are about to drop the `hilo_operaciones` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "hilo_operaciones";

-- CreateTable
CREATE TABLE "alerta_reservas" (
    "thread_id" TEXT NOT NULL,
    "tipo" TEXT,
    "estado" "EstadoOp" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_inicio" TIMESTAMP(3),
    "fecha_ultima_alerta" TIMESTAMP(3),
    "fecha_emision" TIMESTAMP(3),
    "asunto" TEXT,
    "cliente" TEXT,
    "cantidad_alertas" INTEGER NOT NULL DEFAULT 0,
    "ultimo_mensaje" BIGINT,
    "ultima_revision" TIMESTAMP(3),
    "fecha_evento" TIMESTAMP(3),
    "estado_evento" TEXT,
    "fecha_alerta_evento" TIMESTAMP(3),
    "fecha_gestion" TIMESTAMP(3),
    "es_avianca" BOOLEAN DEFAULT false,
    "sheet_row" INTEGER,

    CONSTRAINT "alerta_reservas_pkey" PRIMARY KEY ("thread_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerta_reservas_sheet_row_key" ON "alerta_reservas"("sheet_row");
