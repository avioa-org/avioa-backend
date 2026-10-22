const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
/** Generates only fixed markup; user text is always escaped. */
export function quickReplyHtml(text: string): string {
  if (!text.trim()) return '';
  const out: string[] = [];
  let list = false;
  const close = () => {
    if (list) {
      out.push('</ul>');
      list = false;
    }
  };
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const s = line.trim();
    if (!s) {
      close();
      out.push('<br>');
      continue;
    }
    const bullet = s.match(/^[•●▪*-]\s*(.+)$/);
    if (bullet) {
      if (!list) {
        out.push('<ul style="margin:8px 0;padding-left:24px">');
        list = true;
      }
      out.push('<li>' + escapeHtml(bullet[1]) + '</li>');
      continue;
    }
    close();
    const heading =
      s.length <= 90 && /[A-ZÁÉÍÓÚÑ]/.test(s) && s === s.toUpperCase();
    out.push(
      heading
        ? '<p style="font-weight:bold;color:#1f77bd;margin:10px 0">' +
            escapeHtml(s) +
            '</p>'
        : '<p style="margin:6px 0">' + escapeHtml(line) + '</p>',
    );
  }
  close();
  return (
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#172b46">\n' +
    out.join('\n') +
    '\n</div>'
  );
}
