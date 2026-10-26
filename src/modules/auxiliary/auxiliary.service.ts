import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EncryptionService } from 'src/infrastructure/encryption/encryption.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { StorageService } from 'src/infrastructure/storage/storage.service';
import { Asset, AuxiliaryRecord, SaveInput } from './types/auxiliary.types';
import { buildAuxiliaryPdf } from './utils/pdf-auxiliary.util';
import {
  validateInput,
  validImageBytes,
} from './utils/validation-auxiliary.util';
import { ideahub_v1alpha } from 'googleapis';

@Injectable()
export class AuxiliaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly storage: StorageService,
  ) {}

  private seal(value: unknown) {
    return JSON.stringify(this.encryption.encrypt(JSON.stringify(value)));
  }

  private unseal<T>(value: string): T {
    const p = JSON.parse(value);
    return JSON.parse(
      this.encryption.decrypt(p.encrypted, p.iv, p.authTag),
    ) as T;
  }

  private decode(row: {
    auxiliaryRecordId: string;
    kind: string;
    reference: string;
    sealed: string;
    state: string;
    revision: number;
    updatedAt: Date;
    archivedAt: Date | null;
  }): AuxiliaryRecord {
    return {
      auxiliaryRecordId: row.auxiliaryRecordId,
      kind: row.kind as AuxiliaryRecord['kind'],
      reference: row.reference,
      state: row.state as AuxiliaryRecord['state'],
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() || null,
      ...this.unseal<{ payload: AuxiliaryRecord['payload']; assets: Asset[] }>(
        row.sealed,
      ),
    };
  }

  private key(id: string, fileId: string) {
    return `auxiliary/${id}/${fileId}.encrypted`;
  }

  async list() {
    return (
      await this.prisma.auxiliaryRecord.findMany({
        orderBy: { updatedAt: 'desc' },
      })
    ).map((row) => this.decode(row));
  }

  async find(id: string) {
    const row = await this.prisma.auxiliaryRecord.findUnique({
      where: { auxiliaryRecordId: id },
    });
    if (!row || row.archivedAt)
      throw new NotFoundException('Documento no encontrado.');
    return this.decode(row);
  }

  async save(
    raw: string,
    files: Express.Multer.File[],
    userId: string,
    updating: boolean,
    pathId?: string,
  ) {
    if (typeof raw !== 'string' || raw.length > 250000)
      throw new BadRequestException('Contenido inválido o demasiado largo.');
    let input: SaveInput;

    try {
      input = validateInput(JSON.parse(raw));
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : 'Datos inválidos.',
      );
    }

    if (pathId && input.id !== pathId)
      throw new BadRequestException('El ID no coincide.');
    if (files.length + input.assets.length > 3)
      throw new BadRequestException('Máximo tres imágenes.');
    if (files.length && input.kind !== 'flight' && input.kind !== 'transfer')
      throw new BadRequestException('Este tipo no admite imágenes.');
    if (input.kind === 'flight' && !files.length && !input.assets.length)
      throw new BadRequestException('Adjunta una imagen del itinerario.');
    const old = await this.prisma.auxiliaryRecord.findUnique({
      where: { auxiliaryRecordId: input.id },
    });
    if (updating && !old)
      throw new NotFoundException('Documento no encontrado.');
    if (!updating && old)
      throw new ConflictException('El documento ya existe.');
    if (old?.archivedAt || (old?.revision || 0) !== input.revision)
      throw new ConflictException(
        'El documento cambió. Actualiza el historial.',
      );
    if (old && old.kind !== input.kind)
      throw new BadRequestException(
        'No se puede cambiar el tipo de documento.',
      );

    const previous = old ? this.decode(old) : null;

    if (
      input.assets.some(
        (a) =>
          !previous?.assets.some(
            (x) => JSON.stringify(x) === JSON.stringify(a),
          ),
      )
    )
      throw new BadRequestException('Imagen no autorizada.');

    const assets = [...input.assets],
      uploaded: string[] = [];
    let committed = false;
    try {
      for (const file of files) {
        if (
          !['image/png', 'image/jpeg'].includes(file.mimetype) ||
          !file.size ||
          file.size > 5 * 1024 * 1024 ||
          !validImageBytes(file.buffer, file.mimetype)
        )
          throw new BadRequestException('JPG/PNG de máximo 5 MB.');
        try {
          const { PDFDocument } = await import('pdf-lib'),
            pdf = await PDFDocument.create(),
            img =
              file.mimetype === 'image/png'
                ? await pdf.embedPng(file.buffer)
                : await pdf.embedJpg(file.buffer);
          if (
            img.width < 1 ||
            img.height < 1 ||
            img.width > 10000 ||
            img.height > 10000 ||
            img.width * img.height > 25000000
          )
            throw Error();
        } catch {
          throw new BadRequestException(
            'Imagen inválida o mayor a 25 megapíxeles.',
          );
        }
        const asset: Asset = {
            id: crypto.randomUUID(),
            name: file.originalname.slice(0, 160),
            type: file.mimetype as Asset['type'],
            size: file.size,
          },
          key = this.key(input.id, asset.id);
        await this.storage.uploadFile(
          key,
          Buffer.from(this.seal({ base64: file.buffer.toString('base64') })),
          'application/octet-stream',
        );
        uploaded.push(key);
        assets.push(asset);
      }
      const data = {
        kind: input.kind,
        // reference: recordReference(input),
        reference: '',
        sealed: this.seal({ payload: input.payload, assets }),
        state: input.state,
        revision: input.revision + 1,
        updatedBy: userId,
        archivedAt: null,
      };

      if (old) {
        const result = await this.prisma.auxiliaryRecord.updateMany({
          where: {
            auxiliaryRecordId: input.id,
            revision: input.revision,
            archivedAt: null,
          },
          data,
        });

        if (!result.count) throw new ConflictException('El documento cambió.');
      } else {
        try {
          await this.prisma.auxiliaryRecord.create({
            data: { auxiliaryRecordId: input.id, ...data },
          });
        } catch (e) {
          if ((e as { code?: string }).code === 'P2002')
            throw new ConflictException('El documento ya existe.');
          throw e;
        }
      }
      committed = true;
      for (const asset of previous?.assets || [])
        if (!assets.some((a) => a.id === asset.id))
          await this.storage
            .deleteFile(this.key(input.id, asset.id))
            .catch(() => {});
      return this.find(input.id);
    } catch (e) {
      if (!committed)
        await Promise.all(
          uploaded.map((key) => this.storage.deleteFile(key).catch(() => {})),
        );
      throw e;
    }
  }

  async archive(
    id: string,
    revision: number,
    restore: boolean,
    userId: string,
  ) {
    if (!Number.isSafeInteger(revision) || revision < 1)
      throw new BadRequestException('Revisión inválida.');
    const result = await this.prisma.auxiliaryRecord.updateMany({
      where: { auxiliaryRecordId: id, revision },
      data: {
        archivedAt: restore ? null : new Date(),
        revision: revision + 1,
        updatedBy: userId,
      },
    });
    if (!result.count) throw new ConflictException('Actualiza el historial.');
    return { ok: true };
  }
  async image(id: string, fileId: string) {
    const record = await this.find(id),
      asset = record.assets.find((x) => x.id === fileId);
    if (!asset) throw new NotFoundException('Imagen no encontrada.');
    const cipher = await this.storage.downloadFile(this.key(id, fileId)),
      value = this.unseal<{ base64: string }>(cipher.toString('utf8'));
    return { asset, bytes: Buffer.from(value.base64, 'base64') };
  }

  async pdf(id: string) {
    const record = await this.find(id);
    const images = await Promise.all(
      record.assets.map((a) => this.image(id, a.id)),
    );

    // Si es un transfer, preparamos su branding
    let branding: any = undefined;
    if (record.kind === 'transfer') {
      const v = record.payload as any;
      const destination = v.destination; // ej: "San Andrés"

      // Aquí pones los Base64 estáticos (Camino 1) o los descargas del Storage (Camino 2)
      // Ejemplo con Base64:
      const assetsMap: any = {
        'San Andrés': {
          heroBytes: Buffer.from('PEGA_AQUI_EL_BASE64_DE_LA_PLAYA', 'base64'),
          logoBytes: Buffer.from('PEGA_AQUI_EL_BASE64_DE_PORTOFINO', 'base64'),
          contact: {
            name: 'Miryam Usuga',
            role: 'Jefe Operativo Receptivos',
            phone: '316 832 90 61',
          },
        },
      };

      branding = assetsMap[destination];
    }

    // Le pasamos el branding a tu generador principal
    return buildAuxiliaryPdf(record, images, branding);
  }
}
function recordReference(input: SaveInput) {
  throw new Error('Function not implemented.');
}
