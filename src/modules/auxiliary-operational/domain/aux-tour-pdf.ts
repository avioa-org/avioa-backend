import type { TransferPdfImage } from './transfer-images-pdf';
import { buildTaxiMarinoPdf } from './taximarino-pdf';
import { buildCoastalTourPdf } from './coastal-tour-pdf';
import type { TransferVoucher } from './aux-transfer';
export async function buildTourVoucherPdf(
  v: TransferVoucher,
  images: TransferPdfImage[] = [],
) {
  if (v.template === 'taximarino') return buildTaxiMarinoPdf(v, images);
  if (
    v.template === 'portofino' ||
    v.template === 'transturismo' ||
    v.template === 'naio' ||
    v.template === 'decameronbaru'
  )
    return buildCoastalTourPdf(v, images);
  throw Error('Formato no configurado.');
}
