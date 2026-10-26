import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { Asset, AuxiliaryRecord } from '../types/auxiliary.types';
import { auxVoucherLogo } from '../domain/aux-voucher-logo';
import {
  isHotelTemplate,
  voucherLabels,
  voucherSupportContact,
} from '../domain/aux-voucher';
import { transferLabels } from '../domain/transfer-requests';
import { transferProfiles } from '../domain/aux-transfer-profiles';
import type { TransferVoucher } from '../domain/aux-transfer';
import {
  buildTransferVoucherPdf,
  DestinationBranding,
} from './pdf-voucher.util';
import {
  drawTransferItineraryImages,
  TransferPdfImage,
} from './transfer-pdf.util';

const titles = {
  hotel: 'VOUCHER DE HOTEL',
  transfer: 'VOUCHER DE TRASLADOS',
  request: 'SOLICITUD DE TRASLADO',
  flight: 'ITINERARIO DE VUELOS',
  reply: 'RESPUESTA RÁPIDA',
};

export async function buildAuxiliaryPdf(
  record: AuxiliaryRecord,
  images: { asset: Asset; bytes: Uint8Array }[] = [],
  branding?: DestinationBranding, // <-- NUEVO PARÁMETRO
) {
  // Si es un traslado, delegamos al generador específico que tiene el diseño nuevo
  if (record.kind === 'transfer') {
    const v = record.payload as TransferVoucher;
    const transferImages: TransferPdfImage[] = images.map(
      ({ asset, bytes }) => ({
        image: {
          id: asset.id,
          name: asset.name,
          contentType: asset.type,
          size: asset.size,
          hash: '',
        },
        bytes,
      }),
    );
    return buildTransferVoucherPdf(v, transferImages, branding);
  }

  // ────────────────────────────────────────────────────────────
  // A PARTIR DE AQUÍ ES EL CÓDIGO ANTERIOR (HOTEL, REQUEST, FLIGHT, REPLY)
  // ────────────────────────────────────────────────────────────
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(
    Uint8Array.from(atob(auxVoucherLogo), (c) => c.charCodeAt(0)),
  );

  const blue = rgb(0.02, 0.47, 0.65);
  const ink = rgb(0.1, 0.22, 0.29);
  const muted = rgb(0.42, 0.51, 0.57);

  let page!: PDFPage;
  let y = 0;

  const clean = (value: string) =>
    [...value.normalize('NFC')]
      .map((c) => {
        if (c === '\n' || c === '\r') return c;
        try {
          font.encodeText(c);
          return c;
        } catch {
          return '?';
        }
      })
      .join('');

  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: 0, y: 831, width: 596, height: 11, color: blue });
    page.drawImage(logo, { x: 40, y: 751, width: 110, height: 57 });
    page.drawText(titles[record.kind], {
      x: 180,
      y: 787,
      size: 17,
      font: bold,
      color: ink,
    });
    page.drawText(clean('Reserva: ' + record.reference), {
      x: 180,
      y: 765,
      size: 10,
      font,
      color: muted,
    });
    page.drawLine({
      start: { x: 40, y: 735 },
      end: { x: 555, y: 735 },
      thickness: 1,
      color: rgb(0.85, 0.9, 0.92),
    });
    y = 709;
  }

  function wrap(value: string, width = 510, size = 10) {
    const lines: string[] = [];
    for (const row of clean(value).split(/\r?\n/)) {
      let line = '';
      for (const word of row.split(/\s+/).filter(Boolean)) {
        const proposed = line ? line + ' ' + word : word;
        if (font.widthOfTextAtSize(proposed, size) <= width) {
          line = proposed;
          continue;
        }
        if (line) {
          lines.push(line);
          line = '';
        }
        for (const char of word) {
          if (line && font.widthOfTextAtSize(line + char, size) > width) {
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
    if (y < 120) newPage();
    page.drawText(clean(label.toUpperCase()), {
      x: 40,
      y,
      size: 8.5,
      font: bold,
      color: blue,
    });
    y -= 19;
    for (const line of wrap(value)) {
      if (y < 82) newPage();
      page.drawText(line, { x: 40, y, size: 10, font, color: ink });
      y -= 14;
    }
    y -= 11;
  }

  newPage();
  const data = record.payload as unknown as Record<
    string,
    string | number | boolean
  >;

  // HOTEL
  if (record.kind === 'hotel') {
    for (const [key, label] of Object.entries(voucherLabels)) {
      if (key === 'supportContact') continue;
      if (
        isHotelTemplate(record.payload as any) &&
        [
          'adults',
          'children',
          'rooms',
          'soldBy',
          'roomType',
          'included',
          'checkInTime',
          'checkOutTime',
        ].includes(key)
      )
        continue;
      const value = data[key];
      if (value !== undefined && value !== '' && value !== false)
        block(
          label,
          ['checkIn', 'checkOut'].includes(key)
            ? String(value).split('-').reverse().join('/')
            : String(value),
        );
    }
  }

  // REQUEST
  if (record.kind === 'request') {
    for (const [key, label] of Object.entries(transferLabels))
      block(label, String(data[key] || 'No aplica'));
  }

  // FLIGHT
  if (record.kind === 'flight') {
    block('Pasajeros', String(data.passengers));
  }

  // REPLY
  if (record.kind === 'reply') {
    block(String(data.title), String(data.body));
  }

  // ESTADO TRÁMITE (REQUEST)
  if (record.kind === 'request') {
    block(
      'Estado del trámite',
      record.state === 'confirmed'
        ? 'Confirmación registrada manualmente por el usuario.'
        : record.state === 'manual'
          ? 'Envío manual registrado por el usuario.'
          : 'Pendiente de envío. Este documento no confirma aceptación del operador.',
    );
  }

  block('Soporte aVioa', voucherSupportContact);

  // IMÁGENES (Flight, etc)
  if (images.length && record.kind !== 'transfer') {
    const transferImages: TransferPdfImage[] = images.map(
      ({ asset, bytes }) => ({
        image: {
          id: asset.id,
          name: asset.name,
          contentType: asset.type,
          size: asset.size,
          hash: '',
        },
        bytes,
      }),
    );

    const imgPage = pdf.addPage([595.28, 841.89]);
    page = imgPage;

    await drawTransferItineraryImages(
      pdf,
      imgPage,
      transferImages,
      { x: 40, top: 60, width: 515, height: 690 },
      font,
      bold,
      record.reference,
      clean,
      ink,
      blue,
      muted,
    );
  }

  // FOOTER
  for (const [i, p] of pdf.getPages().entries()) {
    p.drawLine({
      start: { x: 40, y: 60 },
      end: { x: 555, y: 60 },
      thickness: 0.5,
      color: rgb(0.85, 0.9, 0.92),
    });
    p.drawText(clean('aVioa · Documento operativo · v' + record.revision), {
      x: 40,
      y: 40,
      size: 8,
      font,
      color: muted,
    });
    p.drawText(`${i + 1} / ${pdf.getPageCount()}`, {
      x: 515,
      y: 40,
      size: 8,
      font,
      color: muted,
    });
  }

  pdf.setTitle(clean(titles[record.kind] + ' · ' + record.reference));
  pdf.setAuthor('aVioa');
  return pdf.save();
}
