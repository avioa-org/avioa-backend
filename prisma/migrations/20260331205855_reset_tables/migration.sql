/*
  Warnings:

  - You are about to drop the `estados_hilos` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `operaciones` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoPT" AS ENUM ('PENDIENTE', 'SOLICITUD', 'CONFIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "EstadoOp" AS ENUM ('PENDIENTE', 'ALERTA_ENVIADA', 'EMITIDO');

-- DropTable
DROP TABLE "estados_hilos";

-- DropTable
DROP TABLE "operaciones";

-- CreateTable
CREATE TABLE "hilo_operaciones" (
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

    CONSTRAINT "hilo_operaciones_pkey" PRIMARY KEY ("thread_id")
);

-- CreateTable
CREATE TABLE "hilos_pago_total" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "estado" "EstadoPT" NOT NULL DEFAULT 'PENDIENTE',
    "intencion" TEXT,
    "razon" TEXT,
    "ultimo_mensaje" BIGINT NOT NULL,
    "ultima_revision" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hilos_pago_total_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hilo_operaciones_sheet_row_key" ON "hilo_operaciones"("sheet_row");

-- CreateIndex
CREATE UNIQUE INDEX "hilos_pago_total_thread_id_key" ON "hilos_pago_total"("thread_id");
