export type PassportInfo = {
  documentType: 'passport' | 'idcard' | 'unknown';
  expirationDate: string;
};
export function validIsoDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + 'T00:00:00Z')) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
  );
}
export function passportAlert(
  info: PassportInfo | undefined,
  now = new Date(),
): { level: 'warning' | 'danger'; message: string } | null {
  if (!info || info.documentType === 'idcard') return null;
  if (info.documentType === 'unknown')
    return {
      level: 'warning',
      message:
        'No se pudo identificar el tipo de documento. Si es un pasaporte, revisa su vencimiento.',
    };
  if (!validIsoDate(info.expirationDate))
    return {
      level: 'warning',
      message:
        'No se pudo leer la fecha de vencimiento del pasaporte. Revísala en el documento original.',
    };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const today = part('year') + '-' + part('month') + '-' + part('day'),
    year = Number(part('year')) + 1,
    month = Number(part('month')),
    day = Math.min(
      Number(part('day')),
      new Date(Date.UTC(year, month, 0)).getUTCDate(),
    );
  const cutoff =
    String(year) + '-' + part('month') + '-' + String(day).padStart(2, '0');
  const label = info.expirationDate.split('-').reverse().join('/');
  if (info.expirationDate < today)
    return {
      level: 'danger',
      message: 'Pasaporte vencido desde el ' + label + '.',
    };
  if (info.expirationDate === today)
    return {
      level: 'danger',
      message: 'El pasaporte vence hoy (' + label + ').',
    };
  if (info.expirationDate < cutoff)
    return {
      level: 'warning',
      message:
        'Pasaporte con menos de 12 meses de vigencia. Vence el ' + label + '.',
    };
  return null;
}
