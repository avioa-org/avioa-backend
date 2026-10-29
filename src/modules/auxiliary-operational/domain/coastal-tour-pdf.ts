import {
  drawTransferItineraryImages,
  type TransferPdfImage,
} from './transfer-images-pdf';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFPage,
  type PDFImage,
} from 'pdf-lib';
import { auxVoucherLogo } from './aux-voucher-logo';
import { hotelTransferArtwork } from './hotel-transfer-artwork';
import { transferDestinations } from './aux-transfer';
import { coastalTourArtwork } from './coastal-tour-artwork';
import { transferProfiles } from './aux-transfer-profiles';
import type { TransferVoucher } from './aux-transfer';
import {
  transferVoucherSections,
  transferVoucherServiceTitle,
} from './transfer-voucher-content';
import { drawTransferFlightColumns } from './transfer-flight-pdf';

/** Editable data over the visual structure of the supplied destination vouchers. */
export async function buildCoastalTourPdf(
  v: TransferVoucher,
  images: TransferPdfImage[] = [],
) {
  if (
    v.template !== 'portofino' &&
    v.template !== 'transturismo' &&
    v.template !== 'naio' &&
    v.template !== 'decameronbaru'
  )
    throw Error('Formato no configurado.');
  const hotel = v.template === 'naio' || v.template === 'decameronbaru',
    san = v.template === 'portofino',
    profile = transferProfiles[v.template],
    art = hotel
      ? hotelTransferArtwork[v.template as keyof typeof hotelTransferArtwork]
      : coastalTourArtwork[v.template as keyof typeof coastalTourArtwork];
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const decode = (s: string) =>
    Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const logo = await pdf.embedPng(decode(auxVoucherLogo)),
    cover = await pdf.embedJpg(decode(art.cover)),
    strip = await pdf.embedJpg(decode(art.strip)),
    operatorLogo = art.operatorLogo
      ? await pdf.embedJpg(decode(art.operatorLogo))
      : null;
  const gray = rgb(0.41, 0.41, 0.41),
    blue = rgb(0, 0.48, 0.77),
    pale = rgb(0.96, 0.96, 0.96);
  let page: PDFPage;
  function text(
    s: string,
    x: number,
    top: number,
    size = 10,
    heavy = false,
    color = gray,
  ) {
    page.drawText(s.normalize('NFC'), {
      x,
      y: 792 - top - size,
      size,
      font: heavy ? bold : font,
      color,
    });
  }
  function wrap(s: string, width: number, size = 10) {
    const out: string[] = [];
    for (const para of s.split(/\r?\n/)) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        if (
          font.widthOfTextAtSize(line ? line + ' ' + word : word, size) <= width
        ) {
          line = line ? line + ' ' + word : word;
          continue;
        }
        if (line) out.push(line);
        line = '';
        for (const ch of word) {
          if (line && font.widthOfTextAtSize(line + ch, size) > width) {
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
  function image(img: PDFImage, x: number, top: number, w: number, h: number) {
    if (hotel && img !== logo) {
      const scale = Math.max(w / img.width, h / img.height),
        iw = img.width * scale,
        ih = img.height * scale;
      page.pushOperators(
        pushGraphicsState(),
        rectangle(x, 792 - top - h, w, h),
        clip(),
        endPath(),
      );
      page.drawImage(img, {
        x: x + (w - iw) / 2,
        y: 792 - top - h + (h - ih) / 2,
        width: iw,
        height: ih,
      });
      page.pushOperators(popGraphicsState());
    } else page.drawImage(img, { x, y: 792 - top - h, width: w, height: h });
  }
  function header() {
    page.drawRectangle({ x: 0, y: 710, width: 612, height: 82, color: pale });
    image(logo, 44, 20, 82, 43);
    text(
      'NIT: 900971740  |  CRA 55A #26-120  |  +576042005340 / +573024394299',
      235,
      43,
      7,
    );
  }
  const extras: Array<{ title: string; body: string }> = [];
  page = pdf.addPage([612, 792]);
  header();
  const title =
    (v.tours ? 'Voucher tours y traslados · ' : 'Voucher de traslados · ') +
    transferDestinations[v.destination];
  let titleSize = 29;
  while (bold.widthOfTextAtSize(title, titleSize) > 524) titleSize--;
  text(title, 44, 158, titleSize, true);
  page.drawRectangle({ x: 44, y: 563, width: 150, height: 4, color: blue });
  const fields = [
    ['Confirmación', v.operatorReference || v.reservationCode],
    ['Hotel', v.dropoff],
    ['Titular', v.passengers],
    ['Número de personas', String(v.passengerCount)],
  ];
  const wrapped = fields.map(([label, value]) => {
    const rows = wrap(value, 202, 11);
    if (rows.length > 2) {
      extras.push({ title: label, body: value });
      return ['Ver detalle en las páginas siguientes.'];
    }
    return rows;
  });
  const firstHeight = Math.max(wrapped[0].length, wrapped[1].length) * 14 + 44,
    secondHeight = Math.max(wrapped[2].length, wrapped[3].length) * 14 + 44,
    cardTop = 252,
    cardHeight = firstHeight + secondHeight + 20;
  page.drawRectangle({
    x: 44,
    y: 792 - cardTop - cardHeight,
    width: 524,
    height: cardHeight,
    color: pale,
  });
  page.drawLine({
    start: { x: 306, y: 792 - cardTop - 15 },
    end: { x: 306, y: 792 - cardTop - cardHeight + 15 },
    color: rgb(0.8, 0.8, 0.8),
    thickness: 0.6,
  });
  fields.forEach(([label], i) => {
    const x = i % 2 ? 328 : 66,
      top = cardTop + 18 + (i > 1 ? firstHeight : 0);
    text(label, x, top, 13, true);
    wrapped[i].forEach((line, j) => text(line, x, top + 22 + j * 14, 11));
  });
  const flightTop = cardTop + cardHeight + 18;
  const flightColumns = drawTransferFlightColumns(
    page,
    v,
    flightTop,
    font,
    bold,
  );
  extras.push(...flightColumns.extras);
  const photoTop = flightTop + flightColumns.height + 20;
  image(cover, 0, photoTop, 612, 792 - photoTop);
  const detailWidth = hotel ? 524 : 310,
    contentBottom = hotel ? 666 : san ? 644 : 547;
  function detailPage() {
    page = pdf.addPage([612, 792]);
    if (!hotel) image(strip, 393, 0, 219, san ? 495 : 792);
  }
  detailPage();
  const itineraryPage = page,
    imageTop = san ? 380 : 285,
    textLimit = hotel
      ? images.length
        ? 430
        : 610
      : images.length
        ? imageTop - 30
        : 500;
  text('Descripción:', 44, 44, 22, true);
  text(transferVoucherServiceTitle(v), 44, 70, 18, true);
  let y = 112;
  page.drawRectangle({ x: 44, y: 792 - y, width: 148, height: 3, color: blue });
  y += 18;
  for (const section of transferVoucherSections(v, v.template)) {
    const value =
      (san || hotel || v.sourceRequestId
        ? section.title.toUpperCase() + ': '
        : '') + section.text;
    const rows = wrap(value, detailWidth, 9.3);
    if (y + rows.length * 11.1 > textLimit) {
      extras.push({ title: section.title, body: section.text });
      continue;
    }
    rows.forEach((line) => {
      text(line, 44, y, 9.3);
      y += 11.1;
    });
    y += 10;
  }
  const excludedText = v.tours
    ? profile.excluded
    : 'Servicios no especificados en este voucher.';
  const excluded = wrap('No incluye: ' + excludedText, detailWidth, 9.3);
  if (y + excluded.length * 11.1 < (images.length ? textLimit : 510)) {
    excluded.forEach((line) => {
      text(line, 44, y, 9.3, true);
      y += 11.1;
    });
  } else extras.push({ title: 'No incluye', body: excludedText });
  function limited(
    title: string,
    value: string,
    x: number,
    top: number,
    width: number,
    limit: number,
  ) {
    text(title, x, top, 10, true, blue);
    const rows = wrap(value, width, 10);
    const capacity = Math.max(0, Math.floor((limit - top - 24) / 13));
    rows
      .slice(0, capacity)
      .forEach((line, i) => text(line, x, top + 22 + i * 13, 10));
    if (rows.length > capacity)
      extras.push({
        title: title + ' (continuación)',
        body: rows.slice(capacity).join('\n'),
      });
    return top + 22 + Math.min(rows.length, capacity) * 13;
  }
  if (images.length && v.phone)
    extras.push({ title: 'Celular', body: v.phone });
  const phoneEnd =
    v.phone && !images.length
      ? limited(
          'CELULAR:',
          v.phone,
          44,
          Math.max(250, y + 28),
          detailWidth,
          hotel ? 640 : san ? 650 : 548,
        )
      : y;
  const contactTop = hotel ? 690 : san ? 662 : 565;
  page.drawRectangle({
    x: 0,
    y: 792 - contactTop - (hotel ? 80 : san ? 96 : 145),
    width: hotel ? 612 : san ? 612 : 350,
    height: hotel ? 80 : san ? 96 : 145,
    color: pale,
  });
  if (hotel) {
    text('OPERADOR DEL TRASLADO', 44, contactTop + 18, 10, true, blue);
    const lines = wrap(v.operator || profile.name, 280, 10);
    lines
      .slice(0, 2)
      .forEach((line, i) => text(line, 44, contactTop + 37 + i * 13, 10, true));
    if (lines.length > 2) extras.push({ title: 'Operador', body: v.operator });
    profile.contacts.forEach((line, i) =>
      text(line, 330, contactTop + 24 + i * 13, 8),
    );
  } else if (san && operatorLogo) {
    image(operatorLogo, 170, contactTop + 20, 118, 60);
    text('CONTACTO OPERADOR:', 310, contactTop + 24, 10, true, blue);
    profile.contacts.forEach((line, i) =>
      text(line, 310, contactTop + 42 + i * 13, 9),
    );
  } else if (operatorLogo) {
    image(operatorLogo, 205, contactTop + 26, 100, 77);
    text('CONTACTO OPERADOR:', 44, contactTop + 38, 10, true, blue);
    text('Yusmery Flórez', 44, contactTop + 58, 10, true);
    text('Transturismo Cartagena', 44, contactTop + 72, 9);
    text('+573177179943', 44, contactTop + 86, 10);
    text('+573205008848', 44, contactTop + 100, 10);
  }
  if (v.notes.trim()) extras.push({ title: 'Observaciones', body: v.notes });
  // Use the free detail column before adding continuation pages. Keep the operator contact clear.
  let ey = Math.max(y + 18, phoneEnd + 18),
    detailColumn = true;
  const detailLimit = hotel
    ? images.length
      ? 440
      : 666
    : images.length
      ? imageTop - 12
      : san
        ? 644
        : 547;
  let itineraryTop = imageTop;
  function continuation() {
    page = pdf.addPage([612, 792]);
    header();
    text('Voucher ' + profile.name + ' · Continuación', 44, 104, 16, true);
    ey = 142;
    detailColumn = false;
  }
  for (const extra of extras) {
    if (ey + 36 > (detailColumn ? detailLimit : 747)) continuation();
    text(extra.title, 44, ey, 11, true, blue);
    ey += 22;
    // Rewrap the unprinted text when moving from the narrow column to a full page.
    let remaining = extra.body;
    while (remaining) {
      const rows = wrap(remaining, detailColumn ? detailWidth : 524, 10);
      const capacity = Math.max(
        0,
        Math.floor(((detailColumn ? detailLimit : 747) - ey) / 14),
      );
      const visible = rows.slice(0, capacity);
      visible.forEach((line) => {
        text(line, 44, ey, 10);
        ey += 14;
      });
      if (visible.length === rows.length) break;
      remaining = rows.slice(visible.length).join('\n');
      continuation();
      text(extra.title + ' (continuación)', 44, ey, 11, true, blue);
      ey += 22;
    }
    ey += 18;
  }
  if (hotel)
    itineraryTop = Math.min(
      458,
      Math.max(270, detailColumn ? ey + 8 : detailLimit + 18),
    );
  if (images.length)
    await drawTransferItineraryImages(
      pdf,
      itineraryPage,
      images,
      {
        x: 44,
        top: itineraryTop,
        width: detailWidth,
        height: contentBottom - itineraryTop,
      },
      font,
      bold,
      v.reservationCode,
    );
  pdf.getPages().forEach((p, i) =>
    p.drawText(`${i + 1} / ${pdf.getPageCount()}`, {
      x: 564,
      y: 12,
      size: 8,
      font,
      color: gray,
    }),
  );
  pdf.setTitle('Voucher ' + profile.name + ' ' + v.reservationCode);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
