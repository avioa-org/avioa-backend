import {
  driveMovement,
  afterCutover,
  couldAffectBlock,
  type DriveBalance,
} from "./flight-blocking-drive";

export const normalizeBlockingOperator = (v: string) =>
  v.trim().toLowerCase().replace(/\s+/g, " ");

export const isBlockingFlight = (r: { kind?: string; operator?: string }) =>
  r.kind === "Tiquete" &&
  /^transport contract avioa(?:\. contract: transport-\d+(?:,\s*transport-\d+)*)?$/.test(
    normalizeBlockingOperator(r.operator || ""),
  );

export type FlightSource = {
  source?: "manual";
  deletedAt?: string;
  id: string;
  avi: string;
  reference: string;
  operator: string;
  passenger: string;
  advisor: string;
  date: string;
  returnDate: string;
  origin: string;
  destination: string;
  flight: string;
  time: string;
  seats: number | null;
  status: string;
  sourceAt: string;
  createdAt?: string;
  references: string[];
};

export type BlockData = {
  deletedAt?: string;
  source?: "manual";
  drive?: DriveBalance;
  code: string;
  title: string;
  departDate: string;
  returnDate: string;
  departTime: string;
  returnTime: string;
  origin: string;
  destination: string;
  flight: string;
  capacity: number | null;
  notes: string;
  aliases: string[];
};

export type Block = BlockData & {
  id: string;
  revision: number;
  paidAt: string | null;
  paidBy: string | null;
  namesAt: string | null;
  namesBy: string | null;
  namesSignature: string | null;
};

export type Link = {
  serviceId: string;
  blockId: string;
  seats: number | null;
  signature: string;
};

const key = (x: string) => x.trim().toUpperCase().replace(/\s/g, "");

export function flightSignature(s: FlightSource) {
  return JSON.stringify([
    s.avi,
    s.date,
    s.returnDate,
    s.reference,
    s.origin,
    s.destination,
    s.flight,
    s.seats,
    s.references,
  ]);
}

export function paymentDue(day: string) {
  return new Date(Date.parse(day + "T12:00:00Z") - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function namesDue(day: string) {
  return new Date(Date.parse(day + "T12:00:00Z") - 15 * 86400000)
    .toISOString()
    .slice(0, 10);
}

export function summarizeBlocks(
  blocks: Block[],
  services: FlightSource[],
  links: Link[],
  today: string,
) {
  const assignments = services.map((s) => {
    const link = links.find((l) => l.serviceId === s.id);
    let block: Block | undefined,
      reason = "";
    if (link) {
      if (
        link.signature !== flightSignature(s) &&
        !["CANCELED", "CANCELLED", "OUT_OF_SCOPE"].includes(s.status)
      )
        reason = "La reserva cambió: revisa la vinculación.";
      else block = blocks.find((b) => b.id === link.blockId);
    } else {
      const candidates = blocks.filter(
        (b) =>
          b.departDate === s.date &&
          ((s.references || []).some((ref) =>
            [b.code, ...b.aliases].some((x) => key(x) === key(ref)),
          ) ||
            (b.flight &&
              s.flight &&
              key(b.flight) === key(s.flight) &&
              b.origin &&
              b.destination &&
              key(b.origin) === key(s.origin) &&
              key(b.destination) === key(s.destination))),
      );
      if (candidates.length === 1) block = candidates[0];
      else
        reason = candidates.length
          ? "Más de un bloqueo coincide."
          : "Sin bloqueo vinculado.";
    }
    const seats =
      link?.signature === flightSignature(s) && link.seats !== null
        ? link.seats
        : s.seats;
    if (
      !reason &&
      !["BOOKED", "CANCELED", "CANCELLED", "OUT_OF_SCOPE"].includes(s.status)
    )
      reason =
        s.status === "SOURCE_NOT_SEEN"
          ? "La reserva no apareció en la última lectura completa de TC. Requiere revisión; no se liberan cupos."
          : "Confirma el estado de la reserva con Travel Compositor.";
    if (!reason && seats === null)
      reason = "Confirma la cantidad de cupos de esta reserva.";
    return {
      ...s,
      sourceSignature: flightSignature(s),
      blockId: block?.id || null,
      seats,
      reason,
      cancelled: ["CANCELED", "CANCELLED", "OUT_OF_SCOPE"].includes(s.status),
      confirmed: s.status === "BOOKED",
    };
  });

  const inventory = blocks.map((b) => {
    const members = assignments.filter((s) => s.blockId === b.id),
      active = members.filter((s) => !s.cancelled),
      groups = new Map<string, typeof active>();
    for (const s of active) {
      const g = groups.get(s.avi) || [];
      g.push(s);
      groups.set(s.avi, g);
    }
    let sold = 0,
      unresolved = 0;
    const units: { avi: string; seats: number | null }[] = [];
    for (const [avi, items] of groups) {
      const quantities = new Set(items.map((s) => s.seats));
      const ready =
        items.every((s) => !s.reason && s.confirmed && s.seats !== null) &&
        quantities.size === 1;
      const seats = ready ? items[0].seats : null;
      if (seats === null) unresolved++;
      else sold += seats;
      units.push({ avi, seats });
    }
    const unlinked = assignments.filter(
      (s) =>
        !s.cancelled &&
        !s.blockId &&
        (couldAffectBlock(s, b, blocks) ||
          links.some((l) => l.serviceId === s.id && l.blockId === b.id)),
    );
    unresolved += new Set(unlinked.map((s) => s.avi || s.id)).size;
    const remainingMode = !!b.drive && b.drive.inventoryMode !== "total";
    const movement = remainingMode
      ? driveMovement(
          b.drive!,
          units.map((u) => ({ ...u, services: groups.get(u.avi) || [] })),
          members.filter((m) => m.cancelled).map((m) => m.avi),
        )
      : null;
    const signature = JSON.stringify(
      units.sort((a, b) => a.avi.localeCompare(b.avi)),
    );
    const namesComplete =
      !!b.namesAt && b.namesSignature === signature && unresolved === 0;
    const inventoryIssues = [
      ...(movement?.issues || []),
      ...unlinked
        .filter((s) => !remainingMode || afterCutover(s, b.drive!.at) !== false)
        .map((s) => ({
          avi: s.avi || s.id,
          reason:
            s.reason ||
            "Sin bloqueo vinculado: confirma código, ruta y fechas.",
        })),
    ].filter((s, i, items) => items.findIndex((x) => x.avi === s.avi) === i);
    const inventoryUnresolved = movement ? inventoryIssues.length : unresolved;
    return {
      ...b,
      sold,
      netSold: movement?.net ?? sold,
      inventoryUnresolved,
      inventoryIssues,
      unresolved,
      reservations: groups.size,
      available: inventoryUnresolved
        ? null
        : movement
          ? movement.available
          : b.capacity === null
            ? null
            : b.capacity - sold,
      oversold: movement
        ? movement.available !== null && movement.available < 0
        : b.capacity !== null && sold > b.capacity,
      paymentDue: paymentDue(b.departDate),
      namesDue: namesDue(b.departDate),
      paymentAlert: !b.paidAt && paymentDue(b.departDate) <= today,
      namesAlert: !namesComplete && namesDue(b.departDate) <= today,
      namesComplete,
      signature,
      members,
    };
  });
  return {
    blocks: inventory,
    services: assignments,
    unmatched: assignments.filter(
      (s) => !s.cancelled && (!s.blockId || s.reason),
    ),
    alerts: inventory.flatMap((b) => [
      ...(b.paymentAlert
        ? [{ blockId: b.id, kind: "payment", due: b.paymentDue }]
        : []),
      ...(b.namesAlert
        ? [{ blockId: b.id, kind: "names", due: b.namesDue }]
        : []),
    ]),
  };
}