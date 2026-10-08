import { Processor, WorkerHost } from '@nestjs/bullmq';
import { LegalEntity } from '../admin/users/enum/legal-entity.enum';
import { Job } from 'bullmq';
import { CertificadosService } from './certificados.service';
import { Logger } from '@nestjs/common';

export type GenerateCertificateJobData = {
  userId: string;
  legalEntity?: LegalEntity;
  requestedBy: string;
};

export type GenerateCertificateJobResult = {
  url: string;
  key: string;
  expiresInSeconds: number;
};

@Processor('certificados', {
  concurrency: 1,
})
export class CertificadosProcessor extends WorkerHost {
  private readonly logger = new Logger(CertificadosProcessor.name);

  constructor(private readonly certificadosService: CertificadosService) {
    super();
  }

  async process(
    job: Job<GenerateCertificateJobData>,
  ): Promise<GenerateCertificateJobResult> {
    const { userId, legalEntity, requestedBy } = job.data;

    this.logger.log(
      `Procesando certificado laboral — job ${job.id} · user ${userId} · by ${requestedBy}`,
    );

    try {
      await job.updateProgress({
        percentage: 10,
        message: 'Recopilando datos del usuario',
      });

      await job.updateProgress({
        percentage: 30,
        message: 'Generando documento...',
      });

      const result = await this.certificadosService.buildLaboralCertificate(
        userId,
        { legalEntity },
        async (pct, message) => {
          await job.updateProgress({ percentage: pct, message });
        },
      );

      await job.updateProgress({
        percentage: 100,
        message: 'Certificado listo',
      });

      this.logger.log(`Certificado laboral listo — job ${job.id}`);

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error generando certificado — job ${job.id}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }
}
