import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import * as mammoth from 'mammoth';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GenerateCartaDto } from './dto/generate-carta.dto';
import * as ImageModule from 'docxtemplater-image-module-free';
import { TipoDocumento } from './enums/tipo-documento.enum';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  private readonly templatePath = path.join(
    __dirname,
    '..',
    '..',
    'templates',
    'carta_responsabilidades.docx',
  );

  constructor(private readonly prisma: PrismaService) {}

  public async generateCarta(
    generateCartaDto: GenerateCartaDto,
  ): Promise<Buffer> {
    const user = await this.prisma.user.findUnique({
      where: { userId: generateCartaDto.userId },
      include: { signature: true },
    });

    if (!user)
      throw new NotFoundException(
        `User with id ${generateCartaDto.userId} not found`,
      );

    if (!user.signature) {
      throw new NotFoundException(
        `User with id ${generateCartaDto.userId} has no signature`,
      );
    }

    let sigBuffer: Buffer;

    try {
      sigBuffer = await this.resolveSignatureBuffer(
        user.signature.base64,
        user.signature.fileUrl,
      );
    } catch (error) {
      throw new InternalServerErrorException((error as Error).message);
    }

    const template = await this.prisma.template.findUnique({
      where: { templateId: generateCartaDto.templateId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException(
        `Template with id ${generateCartaDto.templateId} not found`,
      );
    }

    const zip = new PizZip(template.buffer as Buffer<ArrayBuffer>);

    const imageModule = new ImageModule({
      centered: false,
      getImage: (tagValue: string) => {
        return sigBuffer;
      },
      getSize: (_img: Buffer, _tagValue: string, _tagName: string) => {
        return [150, 50];
      },
    });

    const doc = new Docxtemplater(zip, {
      modules: [imageModule],
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render({
      asesor: user.name,
      pasajero: generateCartaDto.nombrePasajero,
      orden: generateCartaDto.numeroOrden,
      dia: generateCartaDto.dia,
      mes: generateCartaDto.mes,
      anio: generateCartaDto.anio,
      firma_asesor: 'firma_asesor',
    });

    const filledDocxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

    const pdfBuffer = await this.converToPdf(filledDocxBuffer);
    return pdfBuffer;
  }

  public async uploadDocument(file: Express.Multer.File) {
    try {
      if (
        file.mimetype !==
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        throw new BadRequestException('Only .docx files are allowed');
      }

      const zip = new PizZip(file.buffer);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[[',
          end: ']]',
        },
      });

      const fields = this.extractAllVariables(doc.getFullText());

      const template = await this.prisma.template.create({
        data: {
          name: file.originalname,
          fileUrl: file.path,
          fields,
          buffer: file.buffer as Buffer<ArrayBuffer>,
        },
        select: {
          templateId: true,
          name: true,
          fileUrl: true,
          fields: true,
          isActive: true,
          createdAt: true,
        },
      });

      return { template };
    } catch (error) {
      this.logger.error(`Error processing document: ${error?.['message']}`);
      throw error;
    }
  }

  public getAllTemplates() {
    return this.prisma.template.findMany();
  }

  public async getOneTemplate(templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { templateId, isActive: true },
    });

    if (!template) {
      throw new NotFoundException(`Template ${templateId} not found`);
    }

    const result = await mammoth.convertToHtml({
      buffer: template.buffer as Buffer<ArrayBuffer>,
    });

    this.logger.debug(result.value);

    return template;
  }

  public async uploadSignature(file: Express.Multer.File, userId: string) {
    const signature = await this.prisma.signature.create({
      data: {
        name: file.originalname,
        base64: file.buffer.toString('base64'),
        position: 'ASESOR',
      },
    });

    return { signature };
  }

  private normalizeKey(str: string) {
    return str
      .toLowerCase()
      .replace(/#/g, 'numero')
      .replace(/\s+/g, '_')
      .replace(/[^\w_]/g, '');
  }

  private transformTemplateText(text: string) {
    return text.replace(/\[(.*?)\]/g, (_, match: string) => {
      const key = this.normalizeKey(match);
      return `{{${key}}}`;
    });
  }

  private getFechaParts(fecha: Date) {
    const dia = fecha.getDate();
    const anio = fecha.getFullYear();

    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    const mes = meses[fecha.getMonth()];

    return { dia, mes, anio };
  }

  private extractAllVariables(xml: string) {
    const keys = xml.match(/{{(.*?)}}/g) || [];
    const corchetes = xml.match(/\[(.*?)\]/g) || [];

    const clean = (arr: string[], regex: RegExp) =>
      arr.map((v) => v.replace(regex, '').trim());

    return {
      handlebars: [...new Set(clean(keys, /{{|}}/g))],
      brackets: [...new Set(clean(corchetes, /\[|\]/g))],
    };
  }

  private async resolveSignatureBuffer(
    base64?: string | null,
    fileUrl?: string | null,
  ): Promise<Buffer> {
    if (base64) {
      const raw = base64.includes(',') ? base64.split(',')[1] : base64;

      return Buffer.from(raw, 'base64');
    }

    if (fileUrl) {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        const res = await fetch(fileUrl);
        if (!res.ok)
          throw new Error(`Error downloading signature: ${res.statusText}`);
        return Buffer.from(await res.arrayBuffer());
      }

      if (fs.existsSync(fileUrl)) {
        return fs.readFileSync(fileUrl);
      }

      throw new Error(`File not found: ${fileUrl}`);
    }

    throw new Error('The asesor does not have a signature configured');
  }

  private async converToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-'));
    const docxPath = path.join(tmpDir, 'carta.docx');
    const pdfPath = path.join(tmpDir, 'carta.pdf');

    try {
      fs.writeFileSync(docxPath, docxBuffer);

      await execFileAsync('soffice', [
        '--headless',
        '--convert-to',
        'pdf',
        '--outdir',
        tmpDir,
        docxPath,
      ]);

      if (!fs.existsSync(pdfPath)) {
        throw new Error(
          'LibreOffice failed to generate PDF. Check if libreoffice is installed.',
        );
      }

      return fs.readFileSync(pdfPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}
