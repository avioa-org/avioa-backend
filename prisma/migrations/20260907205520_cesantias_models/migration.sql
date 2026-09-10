-- CreateEnum
CREATE TYPE "CensatiasStatus" AS ENUM ('RECIBIDA', 'EN_REVISION', 'PENDIENTE_DOCUMENTOS', 'CORREGIDA', 'APROBADA', 'RECHAZADA', 'ENVIADA_AL_FONDO', 'PAGADA_FINALIZADA', 'DESISTIDA', 'CERRADA');

-- CreateEnum
CREATE TYPE "CesantiasMotivo" AS ENUM ('EDUCACION', 'COMPRA_VIVIENDA', 'MEJORA_VIVIENDA', 'IMPUESTO_PREDIAL', 'TERMINACION_CONTRATO');

-- CreateTable
CREATE TABLE "cesantias_request" (
    "cesantias_request_id" TEXT NOT NULL,
    "radicado" TEXT NOT NULL,
    "status" "CensatiasStatus" NOT NULL DEFAULT 'RECIBIDA',
    "user_id" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "numero_documento" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "fondo" TEXT NOT NULL,
    "fondo_otro" TEXT,
    "valorSolicitado" DECIMAL(65,30) NOT NULL,
    "saldoDisponible" DECIMAL(65,30),
    "motivo" "CesantiasMotivo" NOT NULL,
    "detalle_motivo" JSONB NOT NULL,
    "declara_veracidad" BOOLEAN NOT NULL,
    "declara_destinacion" BOOLEAN NOT NULL,
    "declara_tratamiento_datos" BOOLEAN NOT NULL,
    "declara_docs_adicionales" BOOLEAN NOT NULL,
    "responsable_id" TEXT,
    "decision" TEXT,
    "motivo_devolucion" TEXT,
    "fecha_decision" TIMESTAMP(3),
    "carta_url" TEXT,
    "numero_tramite_fondo" TEXT,
    "fecha_envio_fondo" TIMESTAMP(3),
    "resultado_final" TEXT,
    "fecha_cierre" TEXT,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cesantias_request_pkey" PRIMARY KEY ("cesantias_request_id")
);

-- CreateTable
CREATE TABLE "cesantias_document" (
    "cesantias_document_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cesantias_document_pkey" PRIMARY KEY ("cesantias_document_id")
);

-- CreateTable
CREATE TABLE "CesantiasHistorial" (
    "cesantias_historial_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "comentario" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CesantiasHistorial_pkey" PRIMARY KEY ("cesantias_historial_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cesantias_request_radicado_key" ON "cesantias_request"("radicado");

-- AddForeignKey
ALTER TABLE "cesantias_request" ADD CONSTRAINT "cesantias_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cesantias_request" ADD CONSTRAINT "cesantias_request_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cesantias_document" ADD CONSTRAINT "cesantias_document_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "cesantias_request"("cesantias_request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CesantiasHistorial" ADD CONSTRAINT "CesantiasHistorial_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "cesantias_request"("cesantias_request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CesantiasHistorial" ADD CONSTRAINT "CesantiasHistorial_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
