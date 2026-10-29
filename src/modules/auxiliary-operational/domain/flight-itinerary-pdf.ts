import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { auxVoucherLogo } from './aux-voucher-logo';
import { voucherContacts } from './aux-voucher';
import type { FlightItinerary } from './flight-itinerary';
import type { TransferImage } from './transfer-images';
export async function buildFlightItineraryPdf(
  data: FlightItinerary,
  images: { image: TransferImage; bytes: Uint8Array }[],
) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    logo = await pdf.embedPng(
      Uint8Array.from(atob(auxVoucherLogo), (c) => c.charCodeAt(0)),
    );
  const ink = rgb(0.08, 0.19, 0.28),
    muted = rgb(0.37, 0.44, 0.48),
    teal = rgb(5 / 255, 120 / 255, 200 / 255),
    pale = rgb(0.96, 0.96, 0.96);
  let page!: PDFPage,
    y = 0;
  function text(
    s: string,
    x: number,
    at: number,
    size = 10,
    heavy = false,
    color = ink,
  ) {
    page.drawText(s.normalize('NFC'), {
      x,
      y: at,
      size,
      font: heavy ? bold : font,
      color,
    });
  }
  function wrap(s: string, width: number, size: number, heavy = false) {
    const f = heavy ? bold : font,
      out: string[] = [];
    for (const original of s.split(/\r?\n/)) {
      let line = '';
      for (const word of original.split(/\s+/).filter(Boolean)) {
        if (
          f.widthOfTextAtSize(line ? line + ' ' + word : word, size) <= width
        ) {
          line = line ? line + ' ' + word : word;
          continue;
        }
        if (line) out.push(line);
        line = '';
        for (const char of word) {
          if (line && f.widthOfTextAtSize(line + char, size) > width) {
            out.push(line);
            line = '';
          }
          line += char;
        }
      }
      if (line) out.push(line);
    }
    return out;
  }
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({
      x: 0,
      y: 744,
      width: 595.28,
      height: 98,
      color: pale,
    });
    page.drawImage(logo, { x: 40, y: 763, width: 100, height: 52 });
    text('DOCUMENTOS DE VIAJE', 390, 789, 8, true, muted);
    text('Itinerario de vuelos', 40, 704, 27, true);
    page.drawRectangle({ x: 40, y: 686, width: 145, height: 3, color: teal });
    const airlineLines = wrap(
        data.airline?.trim() || 'Sin registrar',
        225,
        12,
        true,
      ),
      codeLines = wrap(data.reservationCode, 225, 12, true);
    const height = 46 + Math.max(airlineLines.length, codeLines.length) * 15,
      bottom = 664 - height;
    page.drawRectangle({ x: 40, y: bottom, width: 515, height, color: pale });
    page.drawLine({
      start: { x: 297, y: bottom + 14 },
      end: { x: 297, y: 650 },
      color: rgb(0.82, 0.85, 0.88),
      thickness: 0.7,
    });
    text('AEROLÍNEA', 54, 644, 8, true, muted);
    text('CÓDIGO DE RESERVA', 312, 644, 8, true, muted);
    airlineLines.forEach((line, i) => text(line, 54, 623 - i * 15, 12, true));
    codeLines.forEach((line, i) => text(line, 312, 623 - i * 15, 12, true));
    y = bottom - 30;
  }

  newPage();
  text('PASAJEROS', 40, y, 10, true, teal);
  y -= 21;
  for (const passenger of data.passengers
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    const lines = wrap(passenger.replace(/^[•\-]\s*/, ''), 492, 10);
    for (const [index, line] of lines.entries()) {
      if (y < 90) {
        newPage();
        text('PASAJEROS · CONTINUACIÓN', 40, y, 10, true, teal);
        y -= 21;
      }
      text(index === 0 ? '•' : '', 42, y, 10, false, teal);
      text(line, 56, y, 10);
      y -= 14;
    }
    y -= 4;
  }
  y -= 12;
  for (const [i, item] of images.entries()) {
    if (y - 110 < 100 || i > 0) newPage();
    const image =
      item.image.contentType === 'image/png'
        ? await pdf.embedPng(item.bytes)
        : await pdf.embedJpg(item.bytes);
    text(
      images.length === 1
        ? 'ITINERARIO DE VUELOS'
        : 'ITINERARIO DE VUELOS · IMAGEN ' + (i + 1),
      40,
      y,
      10,
      true,
      teal,
    );
    y -= 20;
    let scale = Math.min(515 / image.width, (y - 82) / image.height);
    if (image.width * scale < 350 && y < 480) {
      newPage();
      text('ITINERARIO DE VUELOS · IMAGEN ' + (i + 1), 40, y, 10, true, teal);
      y -= 20;
      scale = Math.min(515 / image.width, (y - 82) / image.height);
    }
    const width = image.width * scale,
      height = image.height * scale;
    page.drawImage(image, {
      x: 40 + (515 - width) / 2,
      y: y - height,
      width,
      height,
    });
  }
  for (const [i, p] of pdf.getPages().entries()) {
    page = p;
    page.drawLine({
      start: { x: 40, y: 62 },
      end: { x: 555, y: 62 },
      color: rgb(0.82, 0.88, 0.89),
      thickness: 0.7,
    });
    text(
      'INVERSIONES AVIOA S. A. S. · NIT 900971740-2 · RNT 95300',
      40,
      45,
      7.5,
      true,
      teal,
    );
    text(
      voucherContacts.service + ' · ' + voucherContacts.email,
      40,
      31,
      7.5,
      false,
      muted,
    );
    text(`${i + 1} / ${pdf.getPageCount()}`, 526, 31, 8, false, muted);
  }
  pdf.setTitle('Itinerario de vuelos · ' + data.reservationCode);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
