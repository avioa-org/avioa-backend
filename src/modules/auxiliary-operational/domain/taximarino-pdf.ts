import {
  drawTransferItineraryImages,
  type TransferPdfImage,
} from './transfer-images-pdf';
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { auxVoucherLogo } from './aux-voucher-logo';
import { taxiArtwork } from './taximarino-artwork';
import type { TransferVoucher } from './aux-transfer';
import { transferVoucherSections } from './transfer-voucher-content';
import { drawTransferFlightColumns } from './transfer-flight-pdf';

/** Taxi Marino order, based on the supplied two-page branded reference. */
export async function buildTaxiMarinoPdf(
  v: TransferVoucher,
  images: TransferPdfImage[] = [],
) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const decode = (s: string) =>
    Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const logo = await pdf.embedPng(decode(auxVoucherLogo)),
    hero = await pdf.embedJpg(decode(taxiArtwork.hero)),
    bottom = await pdf.embedJpg(decode(taxiArtwork.bottom)),
    photo = await pdf.embedJpg(decode(taxiArtwork.conditions));
  const gray = rgb(0.4, 0.4, 0.4),
    pale = rgb(0.96, 0.96, 0.96);
  let page!: PDFPage;
  function text(s: string, x: number, top: number, size = 10, heavy = false) {
    page.drawText(s, {
      x,
      y: 792 - top - size,
      size,
      font: heavy ? bold : font,
      color: gray,
    });
  }
  function lines(s: string, width: number, size = 10) {
    const out: string[] = [];
    for (const para of s.split(/\r?\n/)) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        if (
          font.widthOfTextAtSize(line ? line + ' ' + word : word, size) <= width
        ) {
          line = line ? line + ' ' + word : word;
          continue;
        }
        if (line) out.push(line);
        line = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(line + ch, size) > width) {
            out.push(line);
            line = '';
          }
          line += ch;
        }
      }
      out.push(line);
    }
    return out;
  }
  function fresh() {
    page = pdf.addPage([612, 792]);
    page.drawImage(logo, { x: 44, y: 728, width: 82, height: 43 });
    text(
      'NIT: 900971740  |  CRA 55A #26-120  |  +576042005340 / +573024394299',
      235,
      43,
      7,
    );
  }
  fresh();
  page.drawImage(hero, { x: 0, y: 497, width: 612, height: 216 });
  const title = 'Orden de Servicio N° ' + v.reservationCode;
  let titleSize = 17;
  while (bold.widthOfTextAtSize(title, titleSize) > 524 && titleSize > 7)
    titleSize--;
  text(
    title,
    Math.max(44, (612 - bold.widthOfTextAtSize(title, titleSize)) / 2),
    320,
    titleSize,
    true,
  );
  text('Santa Marta · Taxi Marino', 222, 347, 10);
  const extras: Array<{ title: string; body: string }> = [];
  function field(
    label: string,
    value: string,
    x: number,
    top: number,
    width: number,
    maxLines = 1,
  ) {
    text(label, x, top, 8, true);
    const rows = lines(value || 'Por confirmar', width, 10);
    if (rows.length > maxLines) {
      text('Ver detalle en las páginas siguientes.', x, top + 13, 9);
      extras.push({ title: label, body: value });
    } else rows.forEach((row, i) => text(row, x, top + 13 + i * 12, 10));
  }
  page.drawRectangle({
    x: 44,
    y: 792 - 373 - 84,
    width: 524,
    height: 84,
    color: pale,
  });
  field('Titular', v.passengers, 58, 380, 224, 2);
  field('Hotel', v.dropoff, 326, 380, 224, 2);
  field('Celular', v.phone || 'No registrado', 58, 424, 224);
  field('Cantidad de pasajeros', String(v.passengerCount), 326, 424, 224);
  extras.push(...drawTransferFlightColumns(page, v, 465, font, bold).extras);
  page.drawImage(bottom, { x: 44, y: 25, width: 524, height: 147 });
  fresh();
  const itineraryPage = page;
  let y = 105;
  function detail(title: string, body: string) {
    if (!body.trim()) return;
    if (y > (images.length && page === itineraryPage ? 300 : 642)) {
      fresh();
      y = 105;
    }
    text(title, 60, y, 11, true);
    y += 19;
    for (const line of lines(body, 492, 10)) {
      if (y > (images.length && page === itineraryPage ? 310 : 670)) {
        fresh();
        y = 105;
        text(title + ' (continuación)', 60, y, 11, true);
        y += 19;
      }
      text(line, 60, y, 10);
      y += 13;
    }
    y += 12;
  }
  for (const item of extras) detail(item.title, item.body);
  if (v.operatorReference)
    detail('Confirmación del operador', v.operatorReference);
  if (v.notes.trim()) detail('Detalles del servicio y observaciones', v.notes);
  for (const item of transferVoucherSections(v, 'taximarino'))
    detail(item.title, item.text);
  if (images.length) {
    page = itineraryPage;
    y = 660;
  } else if (y + 76 > 690) {
    fresh();
    y = 105;
  }
  page.drawRectangle({
    x: 44,
    y: 792 - y - 76,
    width: 524,
    height: 76,
    color: pale,
  });
  text('Contacto del operador:', 60, y + 12, 11, true);
  text('Correo electrónico: reservas@taximarino.com', 60, y + 34);
  text('WhatsApp / Llamada: +573160100594 - +573165228827', 60, y + 51);
  const photoTop = y + 98,
    photoHeight = 792 - photoTop;
  if (photoHeight > 60)
    page.drawImage(photo, { x: 0, y: 0, width: 612, height: photoHeight });
  if (images.length)
    await drawTransferItineraryImages(
      pdf,
      itineraryPage,
      images,
      { x: 60, top: 340, width: 492, height: 295 },
      font,
      bold,
      v.reservationCode,
    );
  pdf.getPages().forEach((p, i) =>
    p.drawText(`${i + 1} / ${pdf.getPageCount()}`, {
      x: 559,
      y: 12,
      size: 8,
      font,
      color: gray,
    }),
  );
  pdf.setTitle('Orden de servicio Taxi Marino ' + v.reservationCode);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
