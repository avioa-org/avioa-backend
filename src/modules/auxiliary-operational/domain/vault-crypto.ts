export const VAULT_OWNER = 'gerenciaviajes@avioa.co';
export const VAULT_ACCOUNTS = [VAULT_OWNER, 'gerenciaavioa@gmail.com'] as const;
export const isVaultAccount = (email: string) =>
  VAULT_ACCOUNTS.some((account) => account === email.trim().toLowerCase());
export const canUseVault = (email: string, role: string | null) =>
  isVaultAccount(email) && role === 'general';
export type VaultData = {
  name: string;
  username: string;
  password: string;
  link: string;
};
const encoder = new TextEncoder();
function fromHex(value: string) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value))
    throw new Error('Invalid encrypted data');
  return Uint8Array.from(value.match(/../g)!, (v) => parseInt(v, 16));
}
function toHex(value: Uint8Array) {
  return Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('');
}
async function key(secret: string) {
  if (!/^[0-9a-f]{64}$/i.test(secret)) throw new Error('Vault unavailable');
  return crypto.subtle.importKey('raw', fromHex(secret), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
export async function sealVault(data: VaultData, secret: string, id: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: encoder.encode(`avioa-auxiliary-operational:v1:${id}`),
    },
    await key(secret),
    encoder.encode(JSON.stringify(data)),
  );
  return `v1:${toHex(iv)}:${toHex(new Uint8Array(encrypted))}`;
}
export async function openVault(
  value: string,
  secret: string,
  id: string,
): Promise<VaultData> {
  const [version, iv, ciphertext, ...extra] = value.split(':');
  if (version !== 'v1' || extra.length || iv?.length !== 24)
    throw new Error('Invalid encrypted data');
  const decoded = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromHex(iv),
      additionalData: encoder.encode(`avioa-auxiliary-operational:v1:${id}`),
    },
    await key(secret),
    fromHex(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(decoded));
}
export function validVaultData(p: VaultData) {
  if (
    typeof p.name !== 'string' ||
    !p.name.trim() ||
    p.name.length > 150 ||
    typeof p.username !== 'string' ||
    !p.username.trim() ||
    p.username.length > 320 ||
    typeof p.password !== 'string' ||
    !p.password ||
    p.password.length > 4096 ||
    typeof p.link !== 'string' ||
    p.link.length > 2000
  )
    return false;
  if (p.link) {
    try {
      const u = new URL(p.link);
      if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password)
        return false;
    } catch {
      return false;
    }
  }
  return true;
}
