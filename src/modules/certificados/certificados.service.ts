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

@Injectable()
export class CertificadosService {
  constructor(
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
  };

  public async generateLaboralCertificate(
    userId: string,
    generateLaboralCertificateDto: { legalEntity?: LegalEntity },
  ) {
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
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const legalEntity =
      generateLaboralCertificateDto.legalEntity ?? user.legalEntity;

    if (!legalEntity) {
      throw new BadRequestException(
        'No se ha proporcionado la razón social del usuario',
      );
    }

    const templateKey = this.templateByLegalEntity[legalEntity];

    if (!templateKey) {
      throw new BadRequestException('No hay plantilla para esa razón social');
    }

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
      meses_str: this.numeroEnLetras(meses).replace(/ PESOS?$/, ''),
      meses_num: String(meses),
    };

    const templateBuffer = await this.storageService.downloadFile(
      templateKey,
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );

    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      delimiters: { start: '{{', end: '}}' },
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    doc.render(data);

    const generateBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const generatedKey = `certificados/${userId}/${Date.now()}-${templateKey}`;
    await this.storageService.uploadFile(
      generatedKey,
      generateBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );

    return await this.storageService.getPresignedDownloadUrl(
      generatedKey,
      60,
      envs.SUPABASE_BUCKET_CERTIFICADOS,
    );
  }
}
