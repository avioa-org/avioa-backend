function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Translata al lunes siguiente si no cae ya en lunes
function nextMonday(date: Date): Date {
  const day = date.getDay();
  if (day === 1) return date;
  const diff = (8 - day) % 7 || 7;
  return addDays(date, diff);
}

function key(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function colombianHolidays(year: number): Set<string> {
  const fixed: Array<[number, number]> = [
    [1, 1], // Año nuevo
    [5, 1], // Dia del trabajador
    [7, 20], // Independencia
    [8, 7], // Batalla de Boyaca
    [12, 8], // Inmaculada concepcion
    [12, 25], // Navidad
  ];

  const emilianiFixed: Array<[number, number]> = [
    [1, 6], // Reyes Magos
    [3, 19], // San José
    [6, 29], // San Pedro y San Pablo
    [8, 15], // Asunción
    [10, 12], // Dia de la raza
    [11, 1], // Todos los santos
    [11, 11], // Independecia de cartagena
  ];

  const holidays = new Set<string>();

  for (const [m, d] of fixed) holidays.add(key(new Date(year, m - 1, d)));
  for (const [m, d] of emilianiFixed) {
    holidays.add(key(nextMonday(new Date(year, m - 1, d))));
  }

  // festivos relativos a pascua
  const easter = easterSunday(year);
  holidays.add(key(addDays(easter, -3))); // Jueves Santo
  holidays.add(key(addDays(easter, -2))); // Viernes Santo

  holidays.add(key(nextMonday(addDays(easter, 43)))); // Ascension (+39 -> lunes)
  holidays.add(key(nextMonday(addDays(easter, 64)))); // Corpus Christi (+60 -> lunes)
  holidays.add(key(nextMonday(addDays(easter, 71)))); // Sagrado Corazón (+68 -> lunes)

  return holidays;
}

/**
 * cuenta dias habiles entre dos fechas (inclusive), exluyendo sábados,
 * domingos y festivos colombianos. Maneja rangos que cruzand fechas
 */
export function countBusinessDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (e < s) return 0;

  const holidayByYear = new Map<number, Set<string>>();
  const getHolidays = (year: number) => {
    if (!holidayByYear.has(year)) {
      holidayByYear.set(year, colombianHolidays(year));
    }
    return holidayByYear.get(year)!;
  };

  let count = 0;
  const cursor = new Date(s);
  while (cursor <= e) {
    const day = cursor.getDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = getHolidays(cursor.getFullYear()).has(key(cursor));
    if (!isWeekend && !isHoliday) count++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}
