export type PassengerSplit = {
  code: string;
  passengers: number;
  note: string;
};

type Member = {
  id: string;
  avi: string;
  blockId: string | null;
  seats: number | null;
  sourceSignature: string;
  cancelled: boolean;
  reason: string;
  confirmed: boolean;
};

export const splitKey = (s: { avi: string; blockId: string | null }) =>
  JSON.stringify([s.avi, s.blockId]);

export function splitContext<T extends Member>(services: T[], service: T) {
  const members = services.filter(
    (s) =>
      s.avi === service.avi && s.blockId === service.blockId && !s.cancelled,
  );
  const quantities = new Set(members.map((s) => s.seats));
  const ready =
    !!service.blockId &&
    members.length > 0 &&
    members.every((s) => !s.reason && s.confirmed && s.seats !== null) &&
    quantities.size === 1;
  return {
    members,
    ready,
    total: ready ? members[0].seats! : null,
    signature: JSON.stringify(
      members
        .map((s) => [s.id, s.sourceSignature, s.seats])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
  };
}

export function validateSplits(
  input: unknown,
  total: number,
): PassengerSplit[] {
  if (!Array.isArray(input) || input.length > 100)
    throw Error('Agrega como máximo 100 códigos.');
  const seen = new Set<string>();
  let count = 0;
  return input.map((row: any) => {
    if (
      !row ||
      typeof row.code !== 'string' ||
      typeof row.note !== 'string' ||
      row.note.length > 300 ||
      !Number.isSafeInteger(row.passengers) ||
      row.passengers < 1 ||
      row.passengers > 500
    )
      throw Error('Revisa el código y los pasajeros de cada división.');
    const code = row.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 _./-]{0,99}$/.test(code) || seen.has(code))
      throw Error('Cada división debe tener un código válido y diferente.');
    seen.add(code);
    count += row.passengers;
    if (count > total)
      throw Error('Las divisiones superan los pasajeros de la reserva madre.');
    return { code, passengers: row.passengers, note: row.note.trim() };
  });
}

export function attachSplits<T extends Member>(
  services: T[],
  events: { serviceId: string; data: string; by: string; at: string }[],
) {
  const latest = new Map<string, (typeof events)[number]>();
  for (const e of events)
    if (!latest.has(e.serviceId)) latest.set(e.serviceId, e);
  return services.map((s) => {
    const context = splitContext(services, s),
      event = latest.get(splitKey(s));
    let saved: {
      splits: PassengerSplit[];
      revision: string;
      signature: string;
    } | null = null;
    try {
      saved = event ? JSON.parse(event.data) : null;
    } catch {}
    const splits: PassengerSplit[] = saved?.splits || [],
      allocated = splits.reduce((n, row) => n + row.passengers, 0);
    return {
      ...s,
      splitSignature: context.signature,
      splitReady: context.ready,
      splits,
      splitRevision: saved?.revision || '',
      splitStale:
        !!saved && (saved.signature !== context.signature || !context.ready),
      splitRemaining: context.total === null ? null : context.total - allocated,
      splitBy: event?.by || null,
      splitAt: event?.at || null,
    };
  });
}
