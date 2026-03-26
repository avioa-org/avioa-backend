-- CreateTable
CREATE TABLE "operaciones" (
    "thread_id" TEXT NOT NULL,
    "tipo" TEXT,
    "estado" TEXT,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_ultima_alerta" TIMESTAMP(3),
    "fecha_emision" TIMESTAMP(3),
    "asunto" TEXT,
    "fecha_evento" TIMESTAMP(3),
    "estado_evento" TEXT,
    "fecha_alerta_evento" TIMESTAMP(3),
    "fecha_gestion" TIMESTAMP(3),
    "es_avianca" BOOLEAN,
    "cantidad_alertas" INTEGER,
    "ultimo_mensaje" BIGINT,
    "ultima_revision" TIMESTAMP(3),

    CONSTRAINT "operaciones_pkey" PRIMARY KEY ("thread_id")
);
