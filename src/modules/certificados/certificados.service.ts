import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import { LegalEntity } from '../admin/users/enum/legal-entity.enum';
import numeroALetras from '@vigilio/numeros-a-letras';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { envs } from 'src/config/env.config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { convertDocxToPdf } from './utils/libreoffice.converter';

@Injectable()
export class CertificadosService {
  constructor(
    @InjectQueue('certificados') private readonly certificadosQueue: Queue,
    private readonly storageService: StorageService,
    private readonly encryptionService: EncryptionService,
    private readonly prisma: PrismaService,
  ) {}

  private numeroEnLetras(n: number): string {
    if (n == null || Number.isNaN(n)) return '';
    return numeroALetras(n, true, {
      centPlural: 'CENTAVOS',
      centSingular: 'CENTAVO',
      Monedaplural: 'PESOS',
      Monedasingular: 'PESO',
    })
      .replace(/,\s*/g, ' ')
      .replace(/\b(MILL[ÓO]N|MILLONES|BILL[ÓO]N|BILLONES)\s+DE\s+/gi, '$1 ')
      .replace(/\s+PESOS?$/i, '')
      .toUpperCase()
      .trim();
  }

  private fechaLarga(fecha: Date | string): string {
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(d);
  }

  private mesesEntre(desde: Date | string, hasta = new Date()): number {
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    if (Number.isNaN(d1.getTime())) return 0;
    return (
      (d2.getFullYear() - d1.getFullYear()) * 12 +
      (d2.getMonth() - d1.getMonth())
    );
  }

  private readonly templateByLegalEntity: Record<LegalEntity, string> = {
    [LegalEntity.INVERSIONES_AVIOA_SAS]:
      'certificado_laboral_activo_inversiones_avioa_plantilla.docx',
    [LegalEntity.GESTION_TURISMO_SAS]:
      'certificado_laboral_activo_gestion_turismo_plantilla.docx',
    [LegalEntity.AVIOA_MAYORISTA_SAS]:
      'certificado_laboral_activo_avioa_mayorista_plantilla.docx',
    [LegalEntity.HOTELES_DE_LA_MONTANA]:
      'certificado_laboral_activo_hoteles_de_la_montana_plantilla.docx',
  };

  private async convertWithQueue(dockxBuffer: Buffer): Promise<Buffer> {
    // return this.convertAsync(dockxBuffer, 'docx', 'pdf');
    return convertDocxToPdf(dockxBuffer);
  }

  public async requestLaboralCertificate(
    userId: string,
    dto: { legalEntity?: LegalEntity },
    requestedBy: string,
  ) {
    const job = await this.certificadosQueue.add(
      'laboral',
      { userId, legalEntity: dto.legalEntity, requestedBy },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600, count: 200 },
        removeOnFail: { age: 24 * 3600 },
      },
    );

    return { jobId: job.id };
  }

  public async buildLaboralCertificate(
    userId: string,
    dto: { legalEntity?: LegalEntity },
    onProgress?: (pct: number, message: string) => Promise<void> | void,
  ) {
    await onProgress?.(35, 'Consultando datos...');

    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        name: true,
        documentType: true,
        documentNumber: true,
        startDate: true,
        position: true,
        salary: true,
        legalEntity: true,
        hasTransportAllowance: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const legalEntity = dto.legalEntity ?? user.legalEntity;
    if (!legalEntity) {
      throw new BadRequestException(
        'No se ha proporcionado la razón social del usuario',
      );
    }

    const baseTemplateKey = this.templateByLegalEntity[legalEntity];
    if (!baseTemplateKey) {
      throw new BadRequestException('No hay plantilla para esa razón social');
    }

    const templateKey = user.hasTransportAllowance
      ? baseTemplateKey
      : baseTemplateKey.replace(/\.docx$/i, '_no_auxilio.docx');

    console.log('templateKey', templateKey);

    let salaryNumber: number | null = null;
    if (user.salary) {
      const parsed = JSON.parse(user.salary) as {
        iv: string;
        encrypted: string;
        authTag: string;
      };
      const plain = this.encryptionService.decrypt(
        parsed.encrypted,
        parsed.iv,
        parsed.authTag,
      );
      salaryNumber = Number(plain);
    }

    const today = new Date();
    const meses = user.startDate ? this.mesesEntre(user.startDate, today) : 0;
    const bonificacion = salaryNumber ? Math.round(salaryNumber * 0.1) : 0;

    const data = {
      fecha_formato: this.fechaLarga(today),
      nombre: user.name ?? '',
      cedula: user.documentNumber ?? '',
      fecha_incorporacion: user.startDate
        ? this.fechaLarga(user.startDate)
        : '',
      cargo: user.position ?? '',
      salario_str: this.numeroEnLetras(salaryNumber ?? 0),
      salario: salaryNumber ? salaryNumber.toLocaleString('es-CO') : '',
      bonificacion_str: this.numeroEnLetras(bonificacion),
      bonificacion: bonificacion ? bonificacion.toLocaleString('es-CO') : '',
      meses_str: this.numeroEnLetras(meses),
      meses_num: String(meses),
    };

    await onProgress?.(50, 'Descargando plantilla...');
    const templateBuffer = await this.storageService.downloadFile(
      templateKey,
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );

    await onProgress?.(70, 'Rellenando documento...');
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });
    doc.render(data);

    const docxBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    await onProgress?.(80, 'Convirtiendo a PDF...');
    const pdfBuffer = await this.convertWithQueue(docxBuffer);

    await onProgress?.(95, 'Subiendo archivo...');
    const generatedKey = `certificados/${userId}/${Date.now()}-certificado-avioa.pdf`;
    await this.storageService.uploadFile(
      generatedKey,
      pdfBuffer,
      'application/pdf',
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );

    const expiresInSeconds = 300;
    const url = await this.storageService.getPresignedDownloadUrl(
      generatedKey,
      expiresInSeconds,
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );

    return { url, key: generatedKey, expiresInSeconds };
  }

  public async getJobStatus(jobId: string) {
    const job = await this.certificadosQueue.getJob(jobId);
    if (!job) throw new NotFoundException('Job no encontrado');

    const state = await job.getState();
    const progress = job.progress;
    const returnValue = job.returnvalue;

    return {
      jobId: job.id,
      state,
      progress,
      result: state === 'completed' ? returnValue : undefined,
      error: state === 'failed' ? job.failedReason : undefined,
    };
  }
}
