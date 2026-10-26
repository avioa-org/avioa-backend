// src/auxiliary/utils/transfer-pdf.util.ts
import { rgb, type PDFDocument, type PDFPage, type PDFFont } from 'pdf-lib';
import type { TransferVoucher } from '../domain/aux-transfer';
import {
  transferFlightDetails,
  transferLongDate,
} from '../domain/transfer-flight-details';

// ── Tipos de imagen ──
export type TransferPdfImage = {
  image: {
    id: string;
    name: string;
    contentType: 'image/jpeg' | 'image/png';
    size: number;
    hash: string;
  };
  bytes: Uint8Array;
};

type ImageBox = { x: number; top: number; width: number; height: number };

// ── Columnas IDA / REGRESO ──
export function drawTransferFlightColumns(
  page: PDFPage,
  v: TransferVoucher,
  top: number,
  font: PDFFont,
  bold: PDFFont,
  hasImages: boolean,
  x = 40,
  width = 515,
) {
  const gap = 24;
  const cardWidth = (width - gap) / 2;
  const compact = hasImages;

  const height = compact
    ? Math.max(
        ...[false, true].map((returning) => {
          const flight = transferFlightDetails(v, returning);
          return [
            returning ? v.returnDate : v.date,
            flight.airline,
            flight.number,
            returning ? v.returnTime : v.time,
          ].filter(Boolean).length;
        }),
      ) *
        28 +
      34
    : 144;

  const gray = rgb(0.35, 0.4, 0.45);
  const pale = rgb(0.96, 0.97, 0.98);
  const extras: Array<{ title: string; body: string }> = [];

  function text(
    value: string,
    left: number,
    at: number,
    size: number,
    heavy = false,
  ) {
    page.drawText(value.normalize('NFC'), {
      x: left,
      y: page.getHeight() - at - size,
      size,
      font: heavy ? bold : font,
      color: gray,
    });
  }

  function field(
    title: string,
    value: string,
    left: number,
    at: number,
    returning: boolean,
  ) {
    text(title, left, at, 8, true);
    const shown = value || 'Por confirmar';
    if (
      shown.includes('\n') ||
      font.widthOfTextAtSize(shown, 10) > cardWidth - 28
    ) {
      text('Ver detalle en las páginas siguientes.', left, at + 13, 9);
      extras.push({
        title: (returning ? 'Regreso · ' : 'Ida · ') + title,
        body: shown,
      });
    } else {
      text(shown, left, at + 13, 10);
    }
  }

  const showReturn =
    v.service === 'roundtrip' ||
    !!(v.returnDate || v.returnFlight || v.returnTime);

  for (const returning of [false, true]) {
    const left = x + (returning ? cardWidth + gap : 0);
    page.drawRectangle({
      x: left,
      y: page.getHeight() - top - height,
      width: cardWidth,
      height,
      color: pale,
    });
    text(returning ? 'REGRESO' : 'IDA', left + 14, top + 9, 11, true);

    if (returning && !showReturn) {
      if (!compact)
        text('Sin datos de regreso registrados.', left + 14, top + 42, 10);
      continue;
    }

    const flight = transferFlightDetails(v, returning);
    const values = [
      [
        returning ? 'Fecha de regreso' : 'Fecha del servicio',
        returning ? v.returnDate : v.date,
      ],
      ['Aerolínea', flight.airline],
      ['Número de vuelo', flight.number],
      [
        v.sourceRequestId ? 'Hora del vuelo' : 'Hora',
        returning ? v.returnTime : v.time,
      ],
    ].filter(([, value]) => !compact || !!value);

    values.forEach(([title, value], index) =>
      field(
        title,
        title.startsWith('Fecha')
          ? transferLongDate(String(value))
          : String(value),
        left + 14,
        top + 30 + index * 28,
        returning,
      ),
    );
  }

  return { height, extras };
}

// ── Imágenes del itinerario ──
export async function drawTransferItineraryImages(
  pdf: PDFDocument,
  firstPage: PDFPage,
  images: TransferPdfImage[],
  box: ImageBox,
  font: PDFFont,
  bold: PDFFont,
  reference: string,
  clean: (s: string) => string,
  ink: any,
  blue: any,
  muted: any,
) {
  let page = firstPage;
  let area = box;

  for (const [index, item] of images.entries()) {
    if (index) {
      page = pdf.addPage([595.28, 841.89]);
      area = { x: 40, top: 60, width: 515, height: 690 };
    }

    // Header en TODAS las páginas de imágenes (primera y extra)
    page.drawRectangle({ x: 0, y: 831, width: 596, height: 11, color: blue });
    page.drawText(clean('ITINERARIO DE VUELOS'), {
      x: 180,
      y: 787,
      size: 17,
      font: bold,
      color: ink,
    });
    page.drawText(clean('Reserva: ' + reference), {
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

    const availableHeight = Math.max(1, area.height - 28);
    const scale = Math.min(
      area.width / embedded.width,
      availableHeight / embedded.height,
    );
    const width = embedded.width * scale;
    const height = embedded.height * scale;

    page.drawImage(embedded, {
      x: area.x + (area.width - width) / 2,
      y: page.getHeight() - area.top - 24 - height,
      width,
      height,
    });
  }
}
