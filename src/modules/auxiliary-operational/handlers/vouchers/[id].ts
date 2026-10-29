import { getRuntime } from '../../runtime';
import {
  auxiliaryAccess,
  auxJson,
  auxUuid,
  auxAudit,
} from '../../domain/auxiliary';
import type { VoucherRow } from '../../domain/aux-voucher';

export async function DELETE(
  r: Request,
  c: { params: Promise<{ id: string }> },
) {
  const a = await auxiliaryAccess(r, true);
  if (a.error) return a.error;
  try {
    const { id } = await c.params;
    if (!auxUuid(id)) return auxJson({ error: 'Voucher inválido.' }, 400);
    const db = getRuntime().DB!,
      row = await db
        .prepare('SELECT * FROM auxop_vouchers WHERE id=?')
        .bind(id)
        .first<VoucherRow>();
    if (!row) return auxJson({ error: 'Voucher no encontrado.' }, 404);
    if (row.deleted_at) return auxJson({ ok: true });
    const at = new Date().toISOString();
    const result = await db
      .prepare(
        "UPDATE auxop_vouchers SET deleted_at=?,updated_at=?,revision=revision+1,encrypted_data='',reservation_code='' WHERE id=? AND deleted_at IS NULL",
      )
      .bind(at, at, id)
      .run();
    if (result.meta.changes)
      await auxAudit(db, a.email!, 'voucher', id, 'delete');
    return auxJson({ ok: true });
  } catch {
    return auxJson(
      { error: 'No se pudo eliminar el voucher. Intenta de nuevo.' },
      503,
    );
  }
}
