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
} from 'pdf-lib';
import { voucherContacts, type HotelVoucher } from './aux-voucher';
import { auxVoucherLogo } from './aux-voucher-logo';
import { hotelVoucherProfiles } from './hotel-voucher-profiles';

// Shared documentation layout for all configured hotels. Content and photos come from each hotel profile.
export async function buildHotelDocumentationPdf(v: HotelVoucher, id: string) {
  const profile = hotelVoucherProfiles[v.template || ''];
  if (!profile) throw Error('Hotel no configurado.');
  const destination = profile.destination,
    hotel = v.hotelName || profile.hotelName,
    meal = v.mealPlan || profile.mealPlan,
    category = profile.category ? `${profile.category} estrellas` : '';
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const photos = await Promise.all(
      profile.photos.map((s) => pdf.embedJpg(decode(s))),
    ),
    logo = await pdf.embedPng(decode(auxVoucherLogo));
  const ink = rgb(0.2, 0.2, 0.2),
    cyan = rgb(0, 0.67, 0.82),
    light = rgb(0.85, 0.85, 0.85);
  const dates = (s: string) =>
      new Date(s + 'T12:00:00Z').toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    short = (s: string) =>
      new Date(s + 'T12:00:00Z').toLocaleDateString('es-CO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      });
  const nights = Math.round(
      (Date.parse(v.checkOut) - Date.parse(v.checkIn)) / 86400000,
    ),
    pax = v.passengers
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    count = v.passengerCount
      ? `${v.passengerCount} pasajero${v.passengerCount === 1 ? '' : 's'}`
      : v.adults > 0
        ? `${v.adults} adultos · ${v.children} niños`
        : `${pax.length} pasajero${pax.length === 1 ? '' : 's'}`,
    ref = v.reservationCode || 'VOUCHER-' + id.slice(0, 8).toUpperCase();
  const longPax = pax.length > 5 || v.passengers.length > 450,
    paxDisplay = longPax
      ? pax
          .slice(0, 3)
          .map((s) => s.slice(0, 100))
          .join('\n') + '\nLista completa de pasajeros al final del documento.'
      : v.passengers;
  let page!: PDFPage;
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    return page;
  }
  function text(
    s: string,
    x: number,
    top: number,
    size = 9,
    heavy = false,
    color = ink,
  ) {
    page.drawText(s, {
      x,
      y: 841.89 - top - size,
      size,
      font: heavy ? bold : font,
      color,
    });
  }
  function line(y: number, x = 42, w = 511, color = light) {
    page.drawLine({
      start: { x, y: 841.89 - y },
      end: { x: x + w, y: 841.89 - y },
      thickness: 0.5,
      color,
    });
  }
  function wrapped(s: string, width: number, size = 9, heavy = false) {
    const f = heavy ? bold : font,
      out: string[] = [];
    for (const part of s.split(/\r?\n/)) {
      let row = '';
      for (const word of part.split(/\s+/).filter(Boolean)) {
        if (f.widthOfTextAtSize(row ? row + ' ' + word : word, size) <= width) {
          row = row ? row + ' ' + word : word;
          continue;
        }
        if (row) {
          out.push(row);
          row = '';
        }
        for (const char of word) {
          if (f.widthOfTextAtSize(row + char, size) > width && row) {
            out.push(row);
            row = '';
          }
          row += char;
        }
      }
      out.push(row);
    }
    return out;
  }
  function lines(
    s: string,
    x: number,
    top: number,
    width: number,
    size = 9,
    leading = 12,
    heavy = false,
  ) {
    let y = top;
    for (const row of wrapped(s, width, size, heavy)) {
      text(row, x, y, size, heavy);
      y += leading;
    }
    return y;
  }
  function photo(i: number, x: number, top: number, w: number, h: number) {
    const image = photos[i];
    if (!image) return;
    const scale = Math.max(w / image.width, h / image.height),
      iw = image.width * scale,
      ih = image.height * scale,
      bottom = 841.89 - top - h;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(x, bottom, w, h),
      clip(),
      endPath(),
    );
    page.drawImage(image, {
      x: x + (w - iw) / 2,
      y: bottom + (h - ih) / 2,
      width: iw,
      height: ih,
    });
    page.pushOperators(popGraphicsState());
  }
  function brand(x = 42, top = 35, w = 78) {
    page.drawImage(logo, {
      x,
      y: 841.89 - top - (w * logo.height) / logo.width,
      width: w,
      height: (w * logo.height) / logo.width,
    });
  }
  function footer(n: number) {
    text('aVioa · ' + voucherContacts.email, 42, 805, 8);
    text(`${n} / ${pdf.getPageCount()}`, 524, 805, 8);
  }
  newPage();
  text('D O C U M E N T A C I Ó N   D E   T U   R E S E R V A:', 42, 50, 7);
  text(ref, 42, 73, 21, true);
  line(116, 42, 55, cyan);
  text(
    'GENERADO ' +
      dates(
        new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      ),
    340,
    157,
    7,
  );
  photo(0, 42, 171, 511, 271);
  text('D A T O S   V I A J E', 42, 484, 8, true);
  text(count, 42, 504);
  text(short(v.checkIn) + ' – ' + short(v.checkOut), 42, 520);
  text(v.hotelName, 42, 536);
  text('C O N T A C T O', 315, 484, 8, true);
  text(voucherContacts.service, 315, 504, 8);
  text(voucherContacts.commercial, 315, 520, 8);
  text(voucherContacts.email, 315, 536, 9);
  text('I T I N E R A R I O', 42, 593, 8, true);
  line(614);
  const destinationBottom = lines(destination, 42, 630, 238, 10, 13, true);
  text(profile.country, 42, destinationBottom + 3, 8);
  text(
    `${nights} noche${nights === 1 ? '' : 's'} · 1 alojamiento`,
    315,
    630,
    10,
    true,
  );
  text('Entrada: ' + short(v.checkIn), 315, 652, 9);
  text('Salida: ' + short(v.checkOut), 315, 669, 9);
  line(Math.max(700, destinationBottom + 25));
  brand(471, 731, 82);
  newPage();
  lines(destination, 42, 59, 380, 12, 14, true);
  text(profile.country, 42, 77, 8);
  text(short(v.checkIn), 437, 62, 10, true);
  let y = lines(profile.description, 42, 99, 511, 8, 11);
  y = Math.max(y + 23, 221);
  lines(hotel, 42, y, 511, 12, 14, true);
  text(v.hotelAddress, 42, y + 20, 8);
  y += 49;
  if (photos.length > 1) {
    for (let i = 0; i < 3; i++) photo(i + 1, 42 + i * 174, y, 165, 109);
    y += 122;
  }
  const cols = [42, 190, 292, 388];
  ['Categoría', 'Noches', 'Plan de comidas', 'Acomodación'].forEach((s, i) =>
    text(s, cols[i], y, 8, true),
  );
  text(category, 42, y + 15, 8);
  text(`${nights} noche(s)`, 190, y + 15, 8);
  text(meal, 292, y + 15, 8);
  y =
    Math.max(
      lines(v.accommodation || v.roomType, 388, y + 15, 165, 8, 10),
      y + 30,
    ) + 12;
  line(y);
  if (profile.amenities.length)
    text('Sobre el alojamiento', 42, y + 9, 9, true);
  y += 30;
  const perCol = Math.ceil(profile.amenities.length / 4);
  profile.amenities.forEach((s, i) => {
    lines(
      '· ' + s,
      42 + Math.floor(i / perCol) * 131,
      y + (i % perCol) * 24,
      123,
      7.5,
      10,
    );
  });
  newPage();
  brand();
  text('Datos del viaje', 42, 117, 13, true);
  const rowY = 151;
  const headers = ['Referencia', 'Pasajeros', 'Fechas', 'Destino'];
  const xs = [42, 166, 284, 448],
    widths = [112, 106, 152, 105];
  headers.forEach((s, i) => text(s, xs[i], rowY, 8, true));
  line(rowY + 17);
  const vals = [
    ref,
    count,
    dates(v.checkIn) + '\n' + dates(v.checkOut) + `\n(${nights} noches)`,
    destination,
  ];
  let bottom = rowY + 30;
  vals.forEach((s, i) => {
    bottom = Math.max(bottom, lines(s, xs[i], rowY + 26, widths[i], 8, 11));
  });
  text('Datos del pasajero', 42, bottom + 14, 9, true);
  bottom = lines(paxDisplay, 42, bottom + 32, 511, 9, 12);
  line(bottom + 7);
  text('Tu viaje', 42, bottom + 24, 14, true);
  text('Tu viaje incluye:', 42, bottom + 45, 9);
  text('Alojamiento', 42, bottom + 75, 13, true);
  line(bottom + 95);
  bottom += 117;
  text('Tu reserva:', 42, bottom, 9);
  bottom += 25;
  [
    v.operatorReference ? 'Referencia del hotel' : 'Referencia del voucher',
    'Huéspedes',
    'Noches',
    'Fechas',
  ].forEach((s, i) => text(s, xs[i], bottom, 8, true));
  line(bottom + 18);
  const hotelVals = [
    v.operatorReference || ref,
    count,
    String(nights),
    dates(v.checkIn) + '\n' + dates(v.checkOut),
  ];
  let next = bottom + 27;
  hotelVals.forEach((s, i) => {
    next = Math.max(next, lines(s, xs[i], bottom + 27, widths[i], 8, 11));
  });
  bottom = next + 20;
  lines(hotel, 42, bottom, 235, 12, 14, true);
  text(category, 42, bottom + 19, 8, false, cyan);
  lines(
    v.hotelAddress +
      '\n' +
      voucherContacts.service +
      '\n' +
      voucherContacts.commercial +
      '\n' +
      voucherContacts.email,
    42,
    bottom + 34,
    235,
    8,
    11,
  );
  next = lines(
    (v.accommodation || v.roomType) + (meal ? ' · ' + meal.toUpperCase() : ''),
    309,
    bottom,
    244,
    9,
    12,
    true,
  );
  next = lines(paxDisplay, 309, next + 8, 244, 8, 11);
  bottom = Math.max(bottom + 83, next) + 19;
  const observations = [
    v.included ? 'Servicios incluidos: ' + v.included : '',
    profile.policy || '',
    v.notes,
  ]
    .filter(Boolean)
    .join('\n\n');
  let observationTop = bottom;
  for (const row of wrapped(observations, 511, 7.5)) {
    if (observationTop > 770) {
      newPage();
      brand();
      text('Condiciones del alojamiento', 42, 110, 15, true);
      observationTop = 145;
    }
    text(row, 42, observationTop, 7.5);
    observationTop += 10;
  }
  if (profile.checkInTime || profile.checkOutTime) {
    if (observationTop > 750) {
      newPage();
      brand();
      observationTop = 130;
    }
    text(
      `Entrada: ${profile.checkInTime || ''} · Salida: ${profile.checkOutTime || ''}`,
      42,
      observationTop + 13,
      8,
      true,
    );
  }
  if (longPax) {
    newPage();
    brand();
    text('Datos de pasajeros · lista completa', 42, 113, 15, true);
    let top = 150;
    for (const passenger of pax) {
      let row = '';
      for (const char of passenger) {
        if (font.widthOfTextAtSize(row + char, 9) > 511) {
          if (top > 770) {
            newPage();
            brand();
            top = 120;
          }
          text(row, 42, top, 9);
          top += 13;
          row = '';
        }
        row += char;
      }
      if (top > 770) {
        newPage();
        brand();
        top = 120;
      }
      text(row, 42, top, 9);
      top += 20;
    }
  }
  pdf.getPages().forEach((p, i) => {
    page = p;
    footer(i + 1);
  });
  pdf.setTitle('Documentación de tu reserva: ' + ref);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
