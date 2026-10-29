import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxData,
} from '../../../domain/auxiliary';
import {
  validHotelVoucher,
  type HotelVoucher,
  type VoucherRow,
} from '../../../domain/aux-voucher';
import { buildHotelVoucherPdf } from '../../../domain/aux-voucher-pdf';

export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Voucher inválido.' }, 400);
    const row = await getRuntime()
      .DB!.prepare(
        'SELECT * FROM auxop_vouchers WHERE id=? AND deleted_at IS NULL',
      )
      .bind(id)
      .first<VoucherRow>();
    if (!row) return auxJson({ error: 'Voucher no encontrado.' }, 404);
    const data = await openAuxData<HotelVoucher>(
      row.encrypted_data,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      id,
    );
    if (!validHotelVoucher(data))
      return auxJson(
        {
          error:
            'Completa los datos y revisa la confirmación antes de descargar.',
        },
        400,
      );
    const bytes = await buildHotelVoucherPdf(data, id),
      name =
        'voucher-hotel-' +
        data.reservationCode.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50) +
        '.pdf';
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return auxJson(
      {
        error:
          'No se pudo generar el PDF. Revisa los datos; usa los nombres en alfabeto latino tal como figuran en el documento.',
      },
      503,
    );
  }
}
