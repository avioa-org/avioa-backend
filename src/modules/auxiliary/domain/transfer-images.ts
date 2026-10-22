export const TRANSFER_IMAGE_LIMIT = 3,
  TRANSFER_IMAGE_BYTES = 5 * 1024 * 1024;
export type TransferImage = {
  id: string;
  name: string;
  contentType: 'image/jpeg' | 'image/png';
  size: number;
  hash: string;
};
export function validTransferImages(value: unknown): value is TransferImage[] {
  return (
    Array.isArray(value) &&
    value.length <= TRANSFER_IMAGE_LIMIT &&
    new Set(value.map((x) => x?.id)).size === value.length &&
    value.every(
      (x) =>
        x &&
        typeof x === 'object' &&
        Object.keys(x).every((k) =>
          ['id', 'name', 'contentType', 'size', 'hash'].includes(k),
        ) &&
        typeof x.id === 'string' &&
        /^[0-9a-f-]{36}-[0-2]$/i.test(x.id) &&
        typeof x.name === 'string' &&
        x.name.length > 0 &&
        x.name.length <= 160 &&
        ['image/jpeg', 'image/png'].includes(x.contentType) &&
        Number.isSafeInteger(x.size) &&
        x.size > 0 &&
        x.size <= TRANSFER_IMAGE_BYTES &&
        typeof x.hash === 'string' &&
        /^[0-9a-f]{64}$/.test(x.hash),
    )
  );
}
export const transferImageKey = (
  voucherId: string,
  image: TransferImage,
  scope: 'transfers' | 'flights' = 'transfers',
) => `auxiliary/${scope}/${voucherId}/${image.id}.encrypted`;
