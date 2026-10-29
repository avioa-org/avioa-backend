import { rgb, type PDFDocument, type PDFPage, type PDFFont } from 'pdf-lib';
import type { TransferImage } from './transfer-images';
export type TransferPdfImage = { image: TransferImage; bytes: Uint8Array };
type ImageBox = { x: number; top: number; width: number; height: number };
/** Place the original image in the reserved voucher space, without cropping or stretching. */
export async function drawTransferItineraryImages(
  pdf: PDFDocument,
  firstPage: PDFPage,
  images: TransferPdfImage[],
  box: ImageBox,
  font: PDFFont,
  bold: PDFFont,
  reference: string,
) {
  let page = firstPage,
    area = box;
  for (const [index, item] of images.entries()) {
    if (index) {
      page = pdf.addPage([612, 792]);
      area = { x: 44, top: 100, width: 524, height: 620 };
      page.drawText(
        'aVioa · Voucher ' +
          reference.replace(/[^\x20-\x7e\xa0-\xff]/g, '?').slice(0, 60),
        { x: 44, y: 750, size: 12, font: bold, color: rgb(0.08, 0.19, 0.28) },
      );
    }
    const embedded =
      item.image.contentType === 'image/png'
        ? await pdf.embedPng(item.bytes)
        : await pdf.embedJpg(item.bytes);
    page.drawText(
      images.length > 1
        ? `Itinerario de vuelos · ${index + 1} de ${images.length}`
        : 'Itinerario de vuelos',
      {
        x: area.x,
        y: page.getHeight() - area.top - 12,
        size: 11,
        font: bold,
        color: rgb(0.08, 0.35, 0.6),
      },
    );
    const availableHeight = Math.max(1, area.height - 28),
      scale = Math.min(
        area.width / embedded.width,
        availableHeight / embedded.height,
      ),
      width = embedded.width * scale,
      height = embedded.height * scale;
    page.drawImage(embedded, {
      x: area.x + (area.width - width) / 2,
      y: page.getHeight() - area.top - 24 - height,
      width,
      height,
    });
  }
}
