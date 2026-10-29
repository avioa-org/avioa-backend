import { readTransferImage } from '../../../domain/transfer-images-server';
import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxData,
} from '../../../domain/auxiliary';
import {
  validTransferVoucher,
  type TransferVoucher,
  type TransferVoucherRow,
} from '../../../domain/aux-transfer';
import { buildTransferVoucherPdf } from '../../../domain/aux-transfer-pdf';

export async function GET(r: Request, c: { params: Promise<{ id: string }> }) {
  const a = await auxiliaryAccess(r);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Voucher inválido.' }, 400);
    const row = await getRuntime()
      .DB!.prepare(
        'SELECT * FROM auxop_transfer_vouchers WHERE id=? AND deleted_at IS NULL',
      )
      .bind(id)
      .first<TransferVoucherRow>();
    if (!row) return auxJson({ error: 'Voucher no encontrado.' }, 404);
    const data = await openAuxData<TransferVoucher>(
      row.encrypted_data,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      'transfer:' + id,
    );
    if (!validTransferVoucher(data))
      return auxJson(
        { error: 'Revisa los datos del traslado antes de descargar.' },
        400,
      );
    const images: {
      image: import('../../../domain/transfer-images').TransferImage;
      bytes: Uint8Array;
    }[] = [];
    if (data.images?.length) {
      if (!getRuntime().BUCKET)
        return auxJson(
          { error: 'Las imágenes del voucher no están disponibles.' },
          503,
        );
      for (const image of data.images)
        images.push({
          image,
          bytes: await readTransferImage(
            getRuntime().BUCKET,
            getRuntime().VAULT_ENCRYPTION_KEY!,
            id,
            image,
          ),
        });
    }
    const bytes = await buildTransferVoucherPdf(data, images);
    const name =
      'voucher-traslado-' +
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
          'No se pudo generar el PDF. Revisa los datos y usa los nombres en alfabeto latino tal como aparecen en el documento.',
      },
      503,
    );
  }
}
