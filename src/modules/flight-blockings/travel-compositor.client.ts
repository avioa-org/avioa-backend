import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";
import type { FlightSource } from "./domain/flight-blockings";

const str = z.string().optional().default("");
const tripSchema = z.object({
  bookingReference: str,
  creationDate: str,
  lastUpdateDate: str,
  adultCount: z.number().int().optional(),
  childCount: z.number().int().optional(),
  infantCount: z.number().int().optional(),
  contactPerson: z.object({ name: str, lastName: str }).optional(),
  user: z.object({ name: str, surname: str, username: str }).optional(),
  distribution: z
    .array(
      z.object({
        person: z
          .array(
            z.object({ id: str, requestedAge: z.number().int().optional() }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
  transportservice: z
    .array(
      z.object({
        id: str,
        providerDescription: str,
        providerName: str,
        supplierName: str,
        provider: str,
        providerBookingReference: str,
        bookingReference: str,
        externalCode: str,
        startDate: str,
        returnDepartureDate: str,
        lastUpdateDate: str,
        status: str,
        departureAirport: str,
        arrivalAirport: str,
        personFareBreakdown: z
          .array(z.object({ personId: str }))
          .optional()
          .default([]),
        segment: z
          .array(
            z.object({
              departureDate: str,
              departureAirport: str,
              arrivalAirport: str,
              flightNumber: str,
              airlineReference: str,
            }),
          )
          .optional()
          .default([]),
      }),
    )
    .optional()
    .default([]),
});
const pageSchema = z.object({
  bookedTrip: z.array(tripSchema),
  pagination: z.object({
    firstResult: z.number().int().nonnegative(),
    pageResults: z.number().int().nonnegative(),
    totalResults: z.number().int().nonnegative(),
  }),
});
const authSchema = z.object({
  token: z.string().min(1),
  expirationInSeconds: z.coerce.number().positive().optional().default(600),
});
export type TcTrip = z.infer<typeof tripSchema>;
const dateKey = (value: Date) =>
  value.toISOString().slice(0, 10).replaceAll("-", "");

@Injectable()
export class TravelCompositorClient {
  private auth: { token: string; base: string; expires: number } | null = null;
  private readonly bases = [
    "https://viajes.avioa.co/resources/",
    "https://online.travelcompositor.com/resources/",
  ];
  private async request(
    base: string,
    path: string,
    token?: string,
    body?: unknown,
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "User-Agent": "aVioa-TravelCompositor/1.0",
    };
    if (token) headers["auth-token"] = token;
    if (body) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(base + path, {
        method: body ? "POST" : "GET",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(90000),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Travel Compositor no respondió. No se aplicó la sincronización.",
      );
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) this.auth = null;
      throw new ServiceUnavailableException(
        `Travel Compositor respondió HTTP ${response.status}.`,
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new ServiceUnavailableException(
        "Travel Compositor no devolvió JSON válido.",
      );
    }
  }
  private async authenticate() {
    if (this.auth && this.auth.expires > Date.now()) return this.auth;
    const username = process.env.TC_API_USERNAME,
      password = process.env.TC_API_PASSWORD,
      micrositeId = process.env.TC_API_MICROSITE;
    if (!username || !password || !micrositeId)
      throw new ServiceUnavailableException(
        "Faltan TC_API_USERNAME, TC_API_PASSWORD o TC_API_MICROSITE.",
      );
    for (const base of this.bases) {
      try {
        const result = authSchema.parse(
          await this.request(base, "authentication/authenticate", undefined, {
            username,
            password,
            micrositeId,
          }),
        );
        this.auth = {
          base,
          token: result.token,
          expires:
            Date.now() + Math.max(0, result.expirationInSeconds - 60) * 1000,
        };
        return this.auth;
      } catch {
        /* Prueba el segundo host sin registrar credenciales ni respuestas. */
      }
    }
    throw new ServiceUnavailableException(
      "No se pudo autenticar Travel Compositor en ninguno de los dos hosts.",
    );
  }
  async fetchAll(
    departureFrom: string,
  ): Promise<{ trips: TcTrip[]; checkedAt: string }> {
    const started = new Date();
    const to = new Date(started.getTime() + 86400000);
    let first = 0,
      total: number | null = null;
    const trips: TcTrip[] = [];
    const seenBookings = new Set<string>();
    const maxPages = Number(process.env.TC_MAX_PAGES || 1000);
    if (!Number.isSafeInteger(maxPages) || maxPages < 1)
      throw new ServiceUnavailableException("TC_MAX_PAGES inválido.");
    for (let page = 0; page < maxPages; page++) {
      const auth = await this.authenticate();
      const query = new URLSearchParams({
        microsite: process.env.TC_API_MICROSITE!,
        from: "20000101",
        to: dateKey(to),
        first: String(first),
        limit: "50",
        fromDepartureDate: departureFrom.replaceAll("-", ""),
      });
      let raw: unknown;
      try {
        raw = await this.request(
          auth.base,
          "booking/getBookings?" + query.toString(),
          auth.token,
        );
      } catch (error) {
        if (this.auth) throw error;
        const renewed = await this.authenticate();
        raw = await this.request(
          renewed.base,
          "booking/getBookings?" + query.toString(),
          renewed.token,
        );
      }
      const parsed = pageSchema.safeParse(raw);
      if (!parsed.success)
        throw new ServiceUnavailableException(
          "Cambió el contrato de reservas/paginación de Travel Compositor.",
        );
      const data = parsed.data;
      if (
        data.pagination.firstResult !== first ||
        data.pagination.pageResults !== data.bookedTrip.length ||
        (total !== null && total !== data.pagination.totalResults)
      )
        throw new ServiceUnavailableException(
          "Paginación inconsistente. Reintenta el GET completo.",
        );
      total = data.pagination.totalResults;
      if (!data.bookedTrip.length && first < total)
        throw new ServiceUnavailableException("Página vacía antes del final.");
      for (const trip of data.bookedTrip) {
        if (!trip.bookingReference || seenBookings.has(trip.bookingReference))
          throw new ServiceUnavailableException(
            "La paginación devolvió una reserva sin referencia o repetida. No se aplica una carga incompleta.",
          );
        seenBookings.add(trip.bookingReference);
      }
      trips.push(...data.bookedTrip);
      first += data.bookedTrip.length;
      if (first > total)
        throw new ServiceUnavailableException(
          "La API devolvió más reservas de las declaradas.",
        );
      if (first === total) return { trips, checkedAt: started.toISOString() };
    }
    throw new ServiceUnavailableException(
      "Se alcanzó TC_MAX_PAGES antes de completar la lectura. No se aplicaron páginas parciales.",
    );
  }
}

export function extractFlights(trips: TcTrip[]): FlightSource[] {
  const result: FlightSource[] = [];
  const blocking = (operator: string) =>
    /^transport contract avioa(?:\. contract: transport-\d+(?:,\s*transport-\d+)*)?$/.test(
      operator.trim().toLowerCase().replace(/\s+/g, " "),
    );
  for (const trip of trips) {
    if (!trip.bookingReference) continue;
    const people = new Map(
      trip.distribution.flatMap((d) => d.person.map((p) => [p.id, p] as const)),
    );
    for (const service of trip.transportservice) {
      if (!service.id) continue;
      const operator =
        service.providerDescription ||
        service.providerName ||
        service.supplierName ||
        service.provider;
      const first = service.segment[0];
      const fareIds = [
        ...new Set(
          service.personFareBreakdown.map((f) => f.personId).filter(Boolean),
        ),
      ];
      let seats: number | null = null;
      if (
        fareIds.length &&
        fareIds.every((id) => {
          const age = people.get(id)?.requestedAge;
          return age !== undefined && Number.isInteger(age) && age >= 2;
        })
      )
        seats = fareIds.length;
      else if (
        trip.transportservice.length === 1 &&
        Number.isInteger(trip.adultCount) &&
        Number.isInteger(trip.childCount) &&
        (trip.adultCount ?? 0) + (trip.childCount ?? 0) > 0 &&
        trip.infantCount === 0
      )
        seats = (trip.adultCount ?? 0) + (trip.childCount ?? 0);
      if (seats !== null && (seats < 1 || seats > 500)) seats = null;
      const sourceAt =
        service.lastUpdateDate || trip.lastUpdateDate || trip.creationDate;
      if (
        !/^\d{4}-\d{2}-\d{2}T/.test(sourceAt) ||
        !Number.isFinite(Date.parse(sourceAt))
      )
        throw new ServiceUnavailableException(
          "Una reserva no tiene fecha de actualización válida.",
        );
      const reference =
        service.providerBookingReference || service.bookingReference;
      result.push({
        id: "FLIGHT-" + service.id,
        avi: trip.bookingReference,
        operator,
        passenger: [trip.contactPerson?.name, trip.contactPerson?.lastName]
          .filter(Boolean)
          .join(" "),
        advisor:
          [trip.user?.name, trip.user?.surname].filter(Boolean).join(" ") ||
          trip.user?.username ||
          "",
        date: (service.startDate || first?.departureDate || "").slice(0, 10),
        returnDate: service.returnDepartureDate.slice(0, 10),
        origin: service.departureAirport || first?.departureAirport || "",
        destination: service.arrivalAirport || first?.arrivalAirport || "",
        flight: first?.flightNumber || "",
        time: (first?.departureDate || service.startDate).slice(11, 16),
        seats,
        reference,
        references: [
          reference,
          service.externalCode,
          ...service.segment.map((s) => s.airlineReference),
        ].filter(Boolean),
        status: blocking(operator)
          ? service.status.toUpperCase()
          : "OUT_OF_SCOPE",
        sourceAt,
        createdAt: trip.creationDate,
      });
    }
  }
  return result;
}
