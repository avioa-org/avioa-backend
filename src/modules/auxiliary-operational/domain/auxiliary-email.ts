export function auxiliaryEmailSignature(body: string) {
  const text = body
    .trim()
    .replace(/(?:\s*(?:\*\*)?Equipo Auxiliares(?:\*\*)?\.?\s*)+$/i, '')
    .trim();
  return text ? text + '\n\nEquipo Auxiliares' : '';
}
