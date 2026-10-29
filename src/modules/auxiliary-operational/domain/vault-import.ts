import { validVaultData, type VaultData } from './vault-crypto';
export const MAX_VAULT_IMPORT = 200;
export const vaultIdentity = (p: Pick<VaultData, 'name' | 'username'>) =>
  JSON.stringify([
    p.name.trim().normalize('NFC').toLocaleLowerCase(),
    p.username.trim().normalize('NFC'),
  ]);
export function parseVaultGrid(grid: unknown[][]): VaultData[] {
  const normalize = (v: unknown) =>
    typeof v === 'string'
      ? v
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
      : '';
  const headers = grid[0]?.map(normalize) || [],
    aliases = [
      ['nombre', 'plataforma', 'mayorista/plataforma', 'mayorista'],
      ['usuario'],
      ['contrasena', 'clave'],
      ['link', 'enlace', 'url'],
    ];
  const cols = aliases.map((names) => {
    const matches = headers.flatMap((v, i) => (names.includes(v) ? [i] : []));
    if (matches.length !== 1)
      throw Error(
        'La primera fila debe tener una sola columna de Nombre, Usuario, Contraseña y Link.',
      );
    return matches[0];
  });
  const result: VaultData[] = [];
  for (let i = 1; i < grid.length; i++) {
    const cells = cols.map((c) => grid[i]?.[c] ?? '');
    if (cells.every((c) => c === '')) continue;
    if (cells.some((c) => typeof c !== 'string'))
      throw Error(
        `Fila ${i + 1}: usa texto, sin fórmulas. Formatea usuario y contraseña como Texto para conservar ceros y caracteres.`,
      );
    const [name, username, password, link] = cells as string[],
      entry = {
        name: name.trim(),
        username: username.trim(),
        password,
        link: link.trim(),
      };
    if (!validVaultData(entry))
      throw Error(
        `Fila ${i + 1}: revisa nombre, usuario, contraseña y un enlace http:// o https:// válido (opcional).`,
      );
    result.push(entry);
    if (result.length > MAX_VAULT_IMPORT)
      throw Error('Importa máximo 200 accesos por archivo.');
  }
  if (!result.length)
    throw Error('El archivo no contiene accesos para importar.');
  return result;
}
