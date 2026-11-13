import { afterCutover, couldAffectBlock } from "./flight-blocking-drive";

export type FlightArrival = "after" | "before" | "unknown" | "manual";

type ArrivalSource = {
  id: string;
  avi: string;
  source?: "manual";
  createdAt?: string;
  sourceAt?: string;
};

export function attachFlightArrival<T extends ArrivalSource>(
  services: T[],
  integrationAt: string,
) {
  const groups = new Map<string, T[]>();
  for (const s of services) {
    if (s.source === "manual") continue;
    const key = s.avi || s.id;
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  return services.map((s) => {
    const group = groups.get(s.avi || s.id) || [],
      classes = group.map((x) =>
        afterCutover(
          { createdAt: x.createdAt, sourceAt: x.sourceAt || "" },
          integrationAt,
        ),
      );
    const arrivalGroup: FlightArrival =
      s.source === "manual"
        ? "manual"
        : !Number.isFinite(Date.parse(integrationAt))
          ? "unknown"
          : classes.every((x) => x === true)
            ? "after"
            : classes.every((x) => x === false)
              ? "before"
              : "unknown";
    const dates = group
      .map((x) => x.createdAt || "")
      .filter((x) => Number.isFinite(Date.parse(x)))
      .sort();
    return {
      ...s,
      arrivalGroup,
      arrivalCreatedAt:
        s.source === "manual"
          ? s.createdAt || s.sourceAt || ""
          : dates[0] || "",
    };
  });
}

export function relatedToFlightBlock(
  s: {
    blockId: string | null;
    date: string;
    returnDate?: string;
    origin?: string;
    destination?: string;
    references?: string[];
  },
  block: Parameters<typeof couldAffectBlock>[1],
  blocks: Parameters<typeof couldAffectBlock>[2] = [],
) {
  return (
    s.blockId === block.id || (!s.blockId && couldAffectBlock(s, block, blocks))
  );
}