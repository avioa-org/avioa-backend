import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFImage,
} from 'pdf-lib';
import {
  drawTransferFlightColumns,
  drawTransferItineraryImages,
  TransferPdfImage,
} from './transfer-pdf.util';
import {
  isTourVoucher,
  transferDestinations,
  TransferVoucher,
} from '../domain/aux-transfer';
import { auxVoucherLogo } from '../domain/aux-voucher-logo';
import { voucherContacts } from '../domain/aux-voucher';

// 1. Agregamos la interfaz para las imágenes del destino
export interface DestinationBranding {
  heroBytes?: Uint8Array;
  logoBytes?: Uint8Array;
  contact?: { name: string; role: string; phone: string };
}

export async function buildTransferVoucherPdf(
  v: TransferVoucher,
  images: TransferPdfImage[] = [],
  branding?: DestinationBranding, // <-- Recibimos el branding
) {
  const tourDetail =
    v.tours === true
      ? 'Tours incluidos: ' + v.tourNotes
      : v.tours === false && !isTourVoucher(v)
        ? 'Tours: no incluidos'
        : '';
  v = { ...v, notes: [tourDetail, v.notes].filter(Boolean).join('\n\n') };

  if (isTourVoucher(v)) {
    // Si es tour voucher, le pasamos el branding (debes actualizar buildTourVoucherPdf también si quieres la foto allí)
    return buildTourVoucherPdf(v, images);
  }

  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(
    Uint8Array.from(atob(auxVoucherLogo), (c) => c.charCodeAt(0)),
  );

  // Pre-cargamos las imágenes del destino si existen
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  let heroImg: PDFImage | undefined;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  let opLogoImg: PDFImage | undefined;

  if (branding?.heroBytes) {
    // Intentamos cargar como PNG o JPG
    try {
      heroImg = await pdf.embedPng(branding.heroBytes);
    } catch {
      heroImg = await pdf.embedJpg(branding.heroBytes);
    }
  }
  if (branding?.logoBytes) {
    try {
      opLogoImg = await pdf.embedPng(branding.logoBytes);
    } catch {
      opLogoImg = await pdf.embedJpg(branding.logoBytes);
    }
  }

  const navy = rgb(0.06, 0.18, 0.35),
    blue = rgb(0.08, 0.35, 0.75),
    gray = rgb(0.37, 0.43, 0.52);
  let page!: PDFPage,
    y = 0;

  function draw(
    value: string,
    x: number,
    at: number,
    size = 11,
    heavy = false,
    color = navy,
  ) {
    page.drawText(value.normalize('NFC'), {
      x,
      y: at,
      size,
      font: heavy ? bold : normal,
      color,
    });
  }

  // 2. Modificamos newPage para dibujar el Hero Image si existe
  function newPage(index?: number) {
    page =
      index === undefined
        ? pdf.addPage([595.28, 841.89])
        : pdf.insertPage(index, [595.28, 841.89]);

    if (heroImg) {
      // Dibujar la foto (150px de alto)
      page.drawImage(heroImg, { x: 0, y: 691.89, width: 595.28, height: 150 });
      // Oscurecer un poco para que el texto blanco resalte
      page.drawRectangle({
        x: 0,
        y: 691.89,
        width: 595.28,
        height: 150,
        color: rgb(0, 0, 0),
        opacity: 0.3,
      });

      // Título encima de la foto (blanco)
      draw(
        'Voucher de traslados · ' + transferDestinations[v.destination],
        42,
        790,
        20,
        true,
        rgb(1, 1, 1),
      );
      draw(
        'Confirmación ' + v.reservationCode,
        42,
        765,
        11,
        false,
        rgb(0.9, 0.9, 0.9),
      );

      y = 670; // Empezar el contenido más abajo
    } else {
      // Diseño original (Fallback)
      page.drawImage(logo, { x: 42, y: 754, width: 110, height: 57.2 });
      draw('VOUCHER DE TRASLADOS', 220, 787, 18, true);
      draw(
        transferDestinations[v.destination] +
          ' · ' +
          (v.service === 'roundtrip' ? 'Ida y regreso' : 'Solo ida'),
        220,
        765,
        11,
        false,
        gray,
      );
      page.drawRectangle({ x: 42, y: 735, width: 511, height: 3, color: blue });
      y = 711;
    }
  }

  function wrap(value: string, width = 495, size = 11) {
    const lines: string[] = [];
    for (const raw of value.normalize('NFC').split(/\r?\n/)) {
      let line = '';
      for (const word of raw.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (normal.widthOfTextAtSize(next, size) <= width) {
          line = next;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const char of word) {
          if (line && normal.widthOfTextAtSize(line + char, size) > width) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function block(label: string, value: string) {
    if (!value.trim()) return;
    const lines = wrap(value);
    if (y < 115) newPage();
    draw(label.toUpperCase(), 42, y, 9, true, blue);
    y -= 19;
    for (const line of lines) {
      if (y < 76) {
        newPage();
        draw(label.toUpperCase() + ' (CONTINUACIÓN)', 42, y, 9, true, blue);
        y -= 19;
      }
      draw(line, 42, y);
      y -= 14;
    }
    y -= 14;
  }

  function route(label: string, origin: string, dropoff: string) {
    block(label, origin + ' a ' + dropoff);
  }

  newPage();
  if (v.sourceRequestId)
    block(
      'Solicitud de servicio',
      'Documento generado desde la solicitud. La disponibilidad y las horas de recogida deben confirmarse con el operador. Las horas indicadas corresponden a los vuelos.',
    );
  block('Número de voucher', v.reservationCode);
  block('Cantidad de pasajeros', String(v.passengerCount));

  if (y - 160 < 76) newPage();
  const flightColumns = drawTransferFlightColumns(
    page,
    v,
    page.getHeight() - y,
    normal,
    bold,
    false,
    42,
    511,
  );
  y -= flightColumns.height + 26;

  for (const extra of flightColumns.extras) block(extra.title, extra.body);
  route('Ruta de ida', v.origin, v.dropoff);
  if (v.service === 'roundtrip') route('Ruta de regreso', v.dropoff, v.origin);
  block('Pasajeros · nombres y documentos', v.passengers);
  if (v.phone) block('Teléfono del titular', v.phone);
  if (v.operator) block('Operador del traslado', v.operator);
  if (v.operatorReference)
    block('Confirmación del operador', v.operatorReference);
  if (v.notes) block('Observaciones', v.notes);

  // 3. Logo y Contacto del Operador
  if (opLogoImg) {
    if (y < 150) newPage(); // Asegurar espacio
    const scale = Math.min(130 / opLogoImg.width, 50 / opLogoImg.height);
    page.drawImage(opLogoImg, {
      x: 42,
      y: y - opLogoImg.height * scale - 10,
      width: opLogoImg.width * scale,
      height: opLogoImg.height * scale,
    });
    y -= opLogoImg.height * scale + 20;
  }

  if (branding?.contact) {
    block(
      'Contacto operador',
      `${branding.contact.name} • ${branding.contact.role}\n${branding.contact.phone}`,
    );
  } else {
    block('Contactos aVioa', Object.values(voucherContacts).join('\n'));
  }

  if (images.length) {
    newPage(1);
    await drawTransferItineraryImages(
      pdf,
      page,
      images,
      { x: 42, top: 145, width: 511, height: 620 },
      normal,
      bold,
      v.reservationCode,
    );
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({
      x: 42,
      y: 49,
      width: 511,
      height: 0.6,
      color: rgb(0.82, 0.87, 0.93),
    });
    p.drawText('aVioa · Presenta este voucher al operador de traslados.', {
      x: 42,
      y: 31,
      size: 9,
      font: normal,
      color: gray,
    });
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: 518,
      y: 31,
      size: 9,
      font: normal,
      color: gray,
    });
  });

  pdf.setTitle('Voucher de traslado ' + v.reservationCode);
  pdf.setAuthor('aVioa');
  return pdf.save();
}
