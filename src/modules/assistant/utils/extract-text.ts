export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (!block || typeof block !== 'object') return '';

        const b = block as Record<string, unknown>;
        if (typeof b.text === 'string') return b.text;

        if (b.type === 'text' && typeof b.text === 'string') return b.text;

        return '';
      })
      .join('');
  }

  return '';
}
