import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import {
  isHotelTemplate,
  voucherSupportContact,
  type HotelVoucher,
} from './aux-voucher';
import { buildHotelDocumentationPdf } from './hotel-documentation-pdf';
import { auxVoucherLogo } from './aux-voucher-logo';
export async function buildHotelVoucherPdf(v: HotelVoucher, id: string) {
  if (isHotelTemplate(v)) return buildHotelDocumentationPdf(v, id);
  const pdf = await PDFDocument.create(),
    normal = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    logo = await pdf.embedPng(
      Uint8Array.from(atob(auxVoucherLogo), (c) => c.charCodeAt(0)),
    ),
    special = isHotelTemplate(v),
    title =
      v.template === 'verdemar'
        ? 'VOUCHER HOTEL VERDE MAR'
        : v.template === 'sunrise'
          ? 'VOUCHER GHL SUNRISE'
          : 'VOUCHER DE HOTEL',
    navy = rgb(0.06, 0.18, 0.35),
    blue = rgb(0.08, 0.35, 0.75),
    gray = rgb(0.37, 0.43, 0.52);
  let page!: PDFPage,
    y = 0;
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
    page.drawImage(logo, { x: 42, y: 754, width: 110, height: 57.2 });
    page.drawText(title, {
      x: 240,
      y: 785,
      size: special ? 16 : 19,
      font: bold,
      color: navy,
    });
    page.drawText('aVioa · Alojamiento', {
      x: 278,
      y: 763,
      size: 10,
      font: normal,
      color: gray,
    });
    page.drawRectangle({ x: 42, y: 735, width: 511, height: 3, color: blue });
    y = 711;
  };
  newPage();
  function text(
    value: string,
    x: number,
    at: number,
    size = 11,
    heavy = false,
    color = navy,
  ) {
    const s = value.normalize('NFC');
    (heavy ? bold : normal).encodeText(s);
    page.drawText(s, { x, y: at, size, font: heavy ? bold : normal, color });
  }
  function wrap(value: string, width = 510, size = 11) {
    const out: string[] = [];
    for (const original of value.normalize('NFC').split(/\r?\n/)) {
      let line = '';
      for (const word of original.split(/\s+/).filter(Boolean)) {
        const proposed = line ? line + ' ' + word : word;
        if (normal.widthOfTextAtSize(proposed, size) <= width) {
          line = proposed;
          continue;
        }
        if (line) {
          out.push(line);
          line = '';
        }
        for (const char of word) {
          if (normal.widthOfTextAtSize(line + char, size) > width && line) {
            out.push(line);
            line = '';
          }
          line += char;
        }
      }
      out.push(line);
    }
    return out;
  }
  function block(label: string, value: string) {
    if (!value.trim()) return;
    const lines = wrap(value);
    if (y - (lines.length * 14 + 32) < 65) newPage();
    if (special) {
      page.drawRectangle({
        x: 42,
        y: y - 6,
        width: 511,
        height: 20,
        color: rgb(0.91, 0.94, 0.97),
      });
    }
    text(label.toUpperCase(), special ? 50 : 42, y, 9, true, blue);
    y -= 20;
    for (const line of lines) {
      if (y < 65) newPage();
      text(line, 42, y, 11);
      y -= 14;
    }
    y -= 10;
  }
  const fmt = (s: string) =>
      s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4),
    nights = Math.round(
      (Date.parse(v.checkOut + 'T00:00:00Z') -
        Date.parse(v.checkIn + 'T00:00:00Z')) /
        86400000,
    );
  block('Número de voucher', v.reservationCode || id.slice(0, 8).toUpperCase());
  if (v.passengerCount)
    block('Cantidad de pasajeros', String(v.passengerCount));
  if (v.reservationCode || v.operatorReference) {
    const refs = [wrap(v.reservationCode, 235), wrap(v.operatorReference, 235)];
    if (v.reservationCode) text('RESERVA', 42, y, 9, true, blue);
    if (v.operatorReference) text('CONFIRMACIÓN HOTEL', 307, y, 9, true, blue);
    y -= 17;
    for (let i = 0; i < Math.max(refs[0].length, refs[1].length); i++) {
      if (y < 65) newPage();
      if (refs[0][i]) text(refs[0][i], 42, y);
      if (refs[1][i]) text(refs[1][i], 307, y);
      y -= 14;
    }
    y -= 14;
  }
  block('Hotel', v.hotelName);
  if (special) block('Destino', v.destination || '');
  if (y < 170) newPage();
  page.drawRectangle({
    x: 42,
    y: y - 65,
    width: 511,
    height: 75,
    color: rgb(0.94, 0.97, 1),
  });
  text('ENTRADA', 58, y - 7, 9, true, blue);
  text(fmt(v.checkIn), 58, y - 29, 14, true);
  text('SALIDA', 241, y - 7, 9, true, blue);
  text(fmt(v.checkOut), 241, y - 29, 14, true);
  text('NOCHES', 441, y - 7, 9, true, blue);
  text(String(nights), 449, y - 29, 14, true);
  y -= 93;
  const quantities = `${v.adults} adulto${v.adults === 1 ? '' : 's'}${v.children ? ` · ${v.children} niño${v.children === 1 ? '' : 's'}` : ''} · ${v.rooms} ${v.rooms === 1 ? 'habitación' : 'habitaciones'}`;
  if (!special) block('Acomodación', quantities);
  block(
    special ? 'Datos de pax · nombres y documentos' : 'Pasajeros',
    v.passengers,
  );
  block(
    'Acomodación',
    [v.accommodation, v.roomType].filter(Boolean).join(' · ') ||
      (special && v.adults > 0 ? quantities : ''),
  );
  if (!special) block('Tipo de habitación', v.roomType);
  block('Plan de alimentación', v.mealPlan);
  block('Servicios incluidos', v.included);
  block(special ? 'Observaciones de la reserva' : 'Observaciones', v.notes);
  block(
    'Contacto de soporte',
    special ? voucherSupportContact : v.supportContact,
  );
  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    p.drawRectangle({
      x: 42,
      y: 49,
      width: 511,
      height: 0.6,
      color: rgb(0.82, 0.87, 0.93),
    });
    p.drawText('aVioa · Presenta este voucher en el hotel.', {
      x: 42,
      y: 31,
      size: 9,
      font: normal,
      color: gray,
    });
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: 520,
      y: 31,
      size: 9,
      font: normal,
      color: gray,
    });
  }
  pdf.setTitle('Voucher de hotel ' + v.reservationCode);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
