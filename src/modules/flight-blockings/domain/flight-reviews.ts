type ReviewService = {
  splitRevision?: string;
  splitStale?: boolean;
  id: string;
  avi: string;
  blockId: string | null;
  seats: number | null;
  reason: string;
  cancelled: boolean;
  deletedAt?: string;
  status: string;
  passenger: string;
  advisor: string;
  sourceSignature: string;
  sourceAt?: string;
};

type ReviewEvent = { serviceId: string; data: string; by: string; at: string };

export function attachFlightReviews<T extends ReviewService>(
  services: T[],
  events: ReviewEvent[],
) {
  const groups = new Map<string, T[]>();
  for (const s of services) {
    const k = s.avi || s.id;
    groups.set(k, [...(groups.get(k) || []), s]);
  }
  const reviews = new Map<string, ReviewEvent>();
  for (const e of events)
    if (!reviews.has(e.serviceId)) reviews.set(e.serviceId, e);
  const summaries = new Map<
    string,
    {
      reviewKey: string;
      reviewSignature: string;
      reviewState: "new" | "changed" | "reviewed";
      reviewBlocked: boolean;
      reviewedAt: string | null;
      reviewedBy: string | null;
    }
  >();
  for (const [key, group] of groups) {
    const signature = JSON.stringify(
      [...group]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((s) => [
          s.id,
          s.sourceSignature,
          s.blockId,
          s.seats,
          s.reason,
          s.cancelled,
          !!s.deletedAt,
          s.status,
          s.passenger,
          s.advisor,
          ...(s.splitRevision ? [s.splitRevision, !!s.splitStale] : []),
        ]),
    );
    const last = reviews.get(key);
    let saved = "";
    try {
      saved = last ? JSON.parse(last.data).signature : "";
    } catch {}
    summaries.set(key, {
      reviewKey: key,
      reviewSignature: signature,
      reviewState: !last ? "new" : saved === signature ? "reviewed" : "changed",
      reviewBlocked: group.some(
        (s) =>
          !s.cancelled &&
          !s.deletedAt &&
          (!s.blockId || s.reason || s.seats === null || s.splitStale),
      ),
      reviewedAt: last?.at || null,
      reviewedBy: last?.by || null,
    });
  }
  return services.map((s) => ({ ...s, ...summaries.get(s.avi || s.id)! }));
}