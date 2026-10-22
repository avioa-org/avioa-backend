export type QuickReply = {
  title: string;
  category: string;
  body: string;
  html: string;
};

export const quickNormalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function cell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number')
    return String(v).replace(/\r\n/g, '\n').trim();
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('formula' in o || 'sharedFormula' in o)
      throw Error(
        'Las fórmulas no son compatibles. Pega los textos como valores.',
      );
    if (Array.isArray(o.richText))
      return o.richText
        .map((x) => String(x.text || ''))
        .join('')
        .trim();
    if (typeof o.text === 'string') return o.text.trim();
  }
  throw Error('Celda no compatible. Usa texto.');
}

export function validQuick(v: unknown): v is QuickReply {
  if (!v || typeof v !== 'object') return false;
  const r = v as QuickReply;
  return (
    typeof r.title === 'string' &&
    !!r.title.trim() &&
    r.title.length <= 250 &&
    typeof r.category === 'string' &&
    !!r.category.trim() &&
    r.category.length <= 150 &&
    typeof r.body === 'string' &&
    !!r.body.trim() &&
    r.body.length <= 20000 &&
    typeof r.html === 'string' &&
    r.html.length <= 200000
  );
}

export function parseQuickGrid(grid: unknown[][]) {
  const rows = grid.map((r) => r.map(cell)),
    entries: QuickReply[] = [],
    issues: string[] = [];

  let duplicates = 0,
    category = 'Mensajes generales';

  const seen = new Set<string>();

  const header = rows.findIndex(
    (r) =>
      r.some((c) => ['titulo', 'nombre'].includes(quickNormalize(c))) &&
      r.some((c) =>
        ['respuesta', 'texto', 'mensaje'].includes(quickNormalize(c)),
      ),
  );

  const add = (entry: QuickReply, n: number) => {
    if (!validQuick(entry)) {
      issues.push(
        `Fila ${n}: título, categoría o respuesta incompletos o demasiado largos.`,
      );
      return;
    }

    const key = JSON.stringify(entry);

    if (seen.has(key)) {
      duplicates++;
      return;
    }

    seen.add(key);

    entries.push(entry);
  };

  if (header >= 0) {
    const h = rows[header].map(quickNormalize),
      col = (names: string[]) => h.findIndex((x) => names.includes(x)),
      t = col(['titulo', 'nombre']),
      b = col(['respuesta', 'texto', 'mensaje']),
      c = col(['categoria', 'destino']),
      html = col(['html']);

    rows.slice(header + 1).forEach((r, i) => {
      if (!r.some(Boolean)) return;
      add(
        {
          title: r[t] || '',
          body: r[b] || '',
          category: r[c] || 'General',
          html: r[html] || '',
        },
        header + i + 2,
      );
    });
  } else {
    if (
      !rows.some((r) => quickNormalize(r[3] || '') === 'ordenes de compra') ||
      !rows.some((r) => /envio/i.test(r[2] || ''))
    )
      throw Error(
        'Formato no reconocido. Usa el documento de respuestas rápidas o encabezados Título, Categoría, Respuesta y HTML (opcional).',
      );

    rows.forEach((r, i) => {
      const [a = '', b = '', c = '', d = '', e = ''] = r;
      if (!r.some(Boolean)) return;
      if (c && c.length < 250 && d.length > 60 && c !== d && b !== c) {
        add(
          { title: c, category: 'Mensajes generales', body: d, html: '' },
          i + 1,
        );
        return;
      }

      const unique = [...new Set(r.filter(Boolean))];

      if (unique.length === 1 && unique[0].length <= 150) {
        category = unique[0];
        return;
      }

      if (a && b && a !== b) {
        add(
          { title: a, category, body: b, html: /<[^>]+>/.test(e) ? e : '' },
          i + 1,
        );
        return;
      }

      issues.push(
        `Fila ${i + 1}: no se identificó una respuesta; revisa esta fila en el Excel.`,
      );
    });
  }
  if (!entries.length) throw Error('No se encontraron respuestas válidas.');

  if (entries.length > 300)
    throw Error('Importa máximo 300 respuestas por archivo.');

  return { entries, issues, duplicates };
}
