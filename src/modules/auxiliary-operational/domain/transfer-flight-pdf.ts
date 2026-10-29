import { rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { TransferVoucher } from './aux-transfer';
import {
  transferFlightDetails,
  transferLongDate,
} from './transfer-flight-details';

/** Identical flight columns across every transfer voucher, with overflow preserved. */
export function drawTransferFlightColumns(
  page: PDFPage,
  v: TransferVoucher,
  top: number,
  font: PDFFont,
  bold: PDFFont,
  x = 44,
  width = 524,
) {
  const gap = 24,
    cardWidth = (width - gap) / 2,
    compact = !!v.images?.length,
    height = compact
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
      : 144,
    gray = rgb(0.35, 0.4, 0.45),
    pale = rgb(0.96, 0.97, 0.98);
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
    } else text(shown, left, at + 13, 10);
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
        title.startsWith('Fecha') ? transferLongDate(value) : value,
        left + 14,
        top + 30 + index * 28,
        returning,
      ),
    );
  }
  return { height, extras };
}
