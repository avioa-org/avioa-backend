import type { ObjectStore } from '../runtime';
import { PDFDocument } from 'pdf-lib';
import { openAuxFile, sealAuxFile, detectAuxMime } from './auxiliary';
import {
  TRANSFER_IMAGE_BYTES,
  TRANSFER_IMAGE_LIMIT,
  transferImageKey,
  type TransferImage,
} from './transfer-images';
export async function prepareTransferImages(files: File[], _requestId: string) {
  if (files.length > TRANSFER_IMAGE_LIMIT)
    throw Error('Puedes adjuntar hasta 3 imágenes.');
  const result: { image: TransferImage; bytes: Uint8Array }[] = [];
  for (const [index, file] of files.entries()) {
    if (
      !(file instanceof File) ||
      file.size < 1 ||
      file.size > TRANSFER_IMAGE_BYTES
    )
      throw Error('Cada imagen debe tener hasta 5 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer()),
      contentType = detectAuxMime(bytes);
    if (contentType !== 'image/jpeg' && contentType !== 'image/png')
      throw Error('Usa imágenes JPG o PNG.');
    if (contentType === 'image/png') {
      if (bytes.length < 24) throw Error('La imagen PNG está incompleta.');
      const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        ),
        width = view.getUint32(16),
        height = view.getUint32(20);
      if (!width || !height || width * height > 4_000_000)
        throw Error(
          'La imagen es demasiado grande. Usa una captura de hasta 4 megapíxeles.',
        );
    }
    try {
      const pdf = await PDFDocument.create(),
        img =
          contentType === 'image/png'
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
      if (!img.width || !img.height || img.width * img.height > 4_000_000)
        throw Error();
    } catch {
      throw Error(
        'No se pudo leer la imagen. Usa un JPG o PNG válido de hasta 4 megapíxeles.',
      );
    }
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (x) => x.toString(16).padStart(2, '0'),
    ).join('');
    result.push({
      image: {
        id: crypto.randomUUID() + '-' + index,
        name:
          file.name.replace(/[\r\n\0\\/]/g, '_').slice(0, 160) || 'itinerario',
        contentType,
        size: bytes.length,
        hash,
      },
      bytes,
    });
  }
  return result;
}
export async function storeTransferImage(
  bucket: ObjectStore,
  secret: string,
  voucherId: string,
  image: TransferImage,
  bytes: Uint8Array,
  scope: 'transfers' | 'flights' = 'transfers',
) {
  const key = transferImageKey(voucherId, image, scope);
  await bucket.put(key, await sealAuxFile(bytes, secret, key), {
    httpMetadata: { contentType: 'application/octet-stream' },
  });
}
export async function readTransferImage(
  bucket: ObjectStore,
  secret: string,
  voucherId: string,
  image: TransferImage,
  scope: 'transfers' | 'flights' = 'transfers',
) {
  const key = transferImageKey(voucherId, image, scope),
    file = await bucket.get(key);
  if (!file)
    throw Error(
      'No se encontró una imagen del itinerario. Vuelve a adjuntarla.',
    );
  return openAuxFile(new Uint8Array(await file.arrayBuffer()), secret, key);
}
export async function appendTransferImages(
  original: Uint8Array,
  images: { image: TransferImage; bytes: Uint8Array }[],
  reference: string,
) {
  const { StandardFonts, rgb } = await import('pdf-lib'),
    pdf = await PDFDocument.load(original),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const [i, item] of images.entries()) {
    const image =
        item.image.contentType === 'image/png'
          ? await pdf.embedPng(item.bytes)
          : await pdf.embedJpg(item.bytes),
      landscape = image.width > image.height * 1.25;
    const [width, height] = landscape ? [841.89, 595.28] : [595.28, 841.89],
      page = pdf.addPage([width, height]);
    page.drawText('Itinerario de vuelo', {
      x: 40,
      y: height - 48,
      size: 18,
      font: bold,
      color: rgb(0.08, 0.19, 0.28),
    });
    page.drawText('aVioa · Anexo ' + (i + 1) + ' de ' + images.length, {
      x: 40,
      y: height - 68,
      size: 9,
      font,
      color: rgb(0.36, 0.43, 0.47),
    });
    const safe = reference.replace(/[^\x20-\x7e\xa0-\xff]/g, '?').slice(0, 80);
    page.drawText('Voucher ' + safe, { x: 40, y: 24, size: 9, font });
    const scale = Math.min(
        (width - 80) / image.width,
        (height - 140) / image.height,
      ),
      w = image.width * scale,
      h = image.height * scale;
    page.drawImage(image, {
      x: (width - w) / 2,
      y: 56 + (height - 140 - h) / 2,
      width: w,
      height: h,
    });
  }
  return pdf.save();
}
