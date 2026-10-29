import { getRuntime } from '../../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  openAuxData,
} from '../../../domain/auxiliary';
import type {
  TransferVoucher,
  TransferVoucherRow,
} from '../../../domain/aux-transfer';
import { readTransferImage } from '../../../domain/transfer-images-server';

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
      ),
      image = data.images?.find(
        (img) => img.id === new URL(r.url).searchParams.get('imageId'),
      );
    if (!image || !getRuntime().BUCKET)
      return auxJson({ error: 'Imagen no encontrada.' }, 404);
    const bytes = await readTransferImage(
      getRuntime().BUCKET,
      getRuntime().VAULT_ENCRYPTION_KEY!,
      id,
      image,
    );
    return new Response(bytes.buffer as ArrayBuffer, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return auxJson({ error: 'No se pudo consultar la imagen.' }, 503);
  }
}
