import type { BlockData, FlightSource } from './flight-blockings';

export type DriveBalance = {
  at: string;
  checkedAt?: string;
  available: number;
  prior: Record<string, number>;
  price: number;
  row: number;
  inventoryMode?: 'remaining' | 'total';
  adjustedAt?: string;
  adjustedBy?: string;
  adjustmentReason?: string;
};

export function driveInventorySignature(data: BlockData) {
  return JSON.stringify([
    data.code,
    data.departDate,
    data.returnDate,
    data.capacity,
    data.drive?.at,
    data.drive?.available,
    data.drive?.inventoryMode || 'remaining',
    Object.entries(data.drive?.prior || {}).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);
}

export function adjustDriveInventory(
  data: BlockData,
  p: { mode: unknown; quantity: unknown; reason: unknown },
  by: string,
  at: string,
): BlockData {
  if (!data.drive || data.deletedAt)
    throw Error('Selecciona un bloqueo activo de Drive.');
  if (p.mode !== 'remaining' && p.mode !== 'total')
    throw Error('Selecciona cómo controlar los cupos.');
  if (
    !Number.isSafeInteger(p.quantity) ||
    (p.quantity as number) < (p.mode === 'total' ? 1 : 0) ||
    (p.quantity as number) > 10000
  )
    throw Error('Indica una cantidad válida de cupos, hasta 10.000.');
  if (
    typeof p.reason !== 'string' ||
    p.reason.trim().length < 5 ||
    p.reason.length > 1000
  )
    throw Error('Indica el motivo del ajuste (entre 5 y 1.000 caracteres).');
  return {
    ...data,
    capacity: p.mode === 'total' ? (p.quantity as number) : data.capacity,
    drive: {
      ...data.drive,
      available:
        p.mode === 'remaining' ? (p.quantity as number) : data.drive.available,
      inventoryMode: p.mode,
      adjustedAt: at,
      adjustedBy: by,
      adjustmentReason: p.reason.trim(),
    },
  };
}

function date(value: string, year: number) {
  const m = value.trim().match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?$/);
  if (!m) throw Error('Fecha no reconocida: ' + value);
  const y = Number(m[3] || year),
    iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (new Date(iso + 'T12:00:00Z').toISOString().slice(0, 10) !== iso)
    throw Error('Fecha inválida');
  return iso;
}

function time(value: string) {
  const m = value.trim().match(/^(\d{1,2})[: ](\d{2})\s*(AM|PM)?$/i);
  if (!m) throw Error('Hora no reconocida: ' + value);
  let h = Number(m[1]);
  if (h <= 12 && m[3]) h = (h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  if (h > 23 || Number(m[2]) > 59) throw Error('Hora inválida');
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

export function parseDriveBlocks(rows: (string | null)[][], at: string) {
  const blocks: (BlockData & { id: string; drive: DriveBalance })[] = [];
  const seen = new Set<string>();
  for (const col of [1, 10]) {
    let title = '',
      year = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [],
        cell = (row[col] || '').trim();
      if (!cell) continue;
      const heading = cell.match(/\b(20\d{2})\b/);
      if (heading && !row[col + 1]) {
        title = cell;
        year = Number(heading[1]);
        continue;
      }
      if (cell === 'CODIGO') continue;
      if (!/^[A-Z0-9]{6}$/.test(cell) || !year)
        throw Error('Código o encabezado no reconocido en fila ' + (i + 1));
      const departDate = date(row[col + 1] || '', year);
      let returnDate = date(row[col + 3] || '', year);
      if (returnDate < departDate && !/\d{4}/.test(row[col + 3] || ''))
        returnDate = date(row[col + 3] || '', year + 1);
      if (returnDate < departDate) throw Error('Regreso anterior a ida');
      const available = Number(row[col + 5]),
        price = Number((row[col + 6] || '').replace(/[$.\s]/g, ''));
      if (
        !Number.isInteger(available) ||
        available < 0 ||
        available > 10000 ||
        !row[col + 5] ||
        !Number.isFinite(price) ||
        price <= 0
      )
        throw Error('Cupos o precio inválidos en fila ' + (i + 1));
      if (seen.has(cell)) throw Error('Código repetido: ' + cell);
      seen.add(cell);
      blocks.push({
        id: 'drive-' + cell,
        code: cell,
        title,
        departDate,
        returnDate,
        departTime: time(row[col + 2] || ''),
        returnTime: time(row[col + 4] || ''),
        origin: '',
        destination: title.startsWith('CARTAGENA')
          ? 'CTG'
          : title.startsWith('SANTA MARTA')
            ? 'SMR'
            : title.startsWith('SAN ANDRES')
              ? 'ADZ'
              : title.startsWith('PUNTA CANA')
                ? 'PUJ'
                : '',
        flight: '',
        capacity: null,
        notes: row[col + 7]?.trim() || '',
        aliases: [],
        drive: { at, available, price, row: i + 1, prior: {} },
      });
    }
  }
  if (!blocks.length) throw Error('No se encontraron bloqueos');
  return blocks;
}

export function afterCutover(
  s: Pick<FlightSource, 'createdAt' | 'sourceAt'>,
  at: string,
): boolean | null {
  if (s.createdAt && Number.isFinite(Date.parse(s.createdAt)))
    return Date.parse(s.createdAt) > Date.parse(at);
  if (s.sourceAt && Date.parse(s.sourceAt) <= Date.parse(at)) return false;
  return null;
}

type CandidateFlight = {
  date: string;
  returnDate?: string;
  origin?: string;
  destination?: string;
  references?: string[];
};
type CandidateBlock = {
  id: string;
  departDate: string;
  returnDate?: string;
  origin?: string;
  destination?: string;
  code?: string;
  aliases?: string[];
};

export function couldAffectBlock(
  s: CandidateFlight,
  b: CandidateBlock,
  blocks: CandidateBlock[] = [],
) {
  if (s.date !== b.departDate) return false;
  const key = (v: string) => v.trim().toUpperCase().replace(/\s/g, '');
  const refs = (s.references || []).map(key).filter(Boolean);
  const identified = blocks.filter((x) =>
    [x.code || '', ...(x.aliases || [])].some(
      (code) => !!code && refs.includes(key(code)),
    ),
  );
  if (identified.length) return identified.some((x) => x.id === b.id);
  if (s.returnDate && b.returnDate && s.returnDate !== b.returnDate)
    return false;
  if (s.origin && b.origin && key(s.origin) !== key(b.origin)) return false;
  if (
    s.destination &&
    b.destination &&
    key(s.destination) !== key(b.destination)
  )
    return false;
  return true;
}

export function driveMovement(
  drive: DriveBalance,
  groups: { avi: string; seats: number | null; services: FlightSource[] }[],
  cancelledAvis: string[] = [],
) {
  let net = 0,
    pending = 0;
  const seen = new Set<string>(),
    issues: { avi: string; reason: string }[] = [];
  for (const group of groups) {
    seen.add(group.avi);
    const baseline = drive.prior[group.avi];
    const classifications = group.services.map((s) =>
      afterCutover(s, drive.at),
    );
    if (baseline === undefined && classifications.every((x) => x === false))
      continue;
    if (
      group.seats === null ||
      (baseline === undefined && classifications.some((x) => x === null))
    ) {
      pending++;
      issues.push({
        avi: group.avi,
        reason:
          group.seats === null
            ? 'Confirma los cupos y el estado de los servicios.'
            : 'Falta confirmar si la reserva es anterior o posterior al saldo inicial.',
      });
      continue;
    }
    net += group.seats - (baseline || 0);
  }
  for (const [avi, seats] of Object.entries(drive.prior))
    if (!seen.has(avi)) {
      if (cancelledAvis.includes(avi)) net -= seats;
      else {
        pending++;
        issues.push({
          avi,
          reason:
            'Reserva del saldo inicial ausente: confirma su estado antes de liberar cupos.',
        });
      }
    }
  return {
    net,
    pending,
    issues,
    available: pending ? null : drive.available - net,
  };
}
