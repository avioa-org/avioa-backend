export type OfferCurrency = 'COP' | 'USD' | 'MXN' | (string & {});
export type OfferStatus =
  | 'BORRADOR'
  | 'EN_REVISION'
  | 'PUBLICADA_DEMO'
  | (string & {});
export type OfferKind = 'VUELO_HOTEL' | 'CIRCUITO' | (string & {});
export type OfferVariantKind = 'HOTEL' | 'COMBINADO' | (string & {});

export interface OfferPeriod {
  id: string;
  label: string;
  nights: number;
  start: string;
  end: string;
  flexible: boolean;
  recommended: boolean;
  extraDates?: OfferExtraDate[];
  partialStart?: string;
  partialEnd?: string;
  departureDateIssue?: string;
}

export interface OfferExtraDate {
  id: string;
  start?: string;
  end?: string;
  partialStart?: string;
  partialEnd?: string;
  departureDateIssue?: string;
}

export interface OfferVariant {
  id: string;
  periodId: string;
  name: string;
  hotel: string;
  price: number;
  currency: OfferCurrency;
  basis: string;
  occupancy: string;
  meal: string;
  room: string;
  kind: OfferVariantKind;
  notes: string;
  availability: string;
}

export interface OfferCondition {
  type: string;
  text: string;
}

export interface OfferCharge {
  id: string;
  name: string;
  amount: number | null;
  currency: OfferCurrency;
  unit: string;
  mandatory: boolean;
  included: boolean;
  note: string;
}

export interface OfferPromotion {
  id: string;
  title: string;
  variantIds: string[];
  kind: string;
  maxChildren?: number | null;
  maxAge?: number | null;
  minAdults?: number | null;
  childFlightFrom?: number | null;
  notes: string;
}

export interface Offer {
  id: string;
  title: string;
  origin: string;
  dest: string;
  destName: string;
  kind: OfferKind;
  status: OfferStatus;
  source: string;
  sourceRow: number | null;
  sourceFile: string;
  periods: OfferPeriod[];
  variants: OfferVariant[];
  includes: string[];
  excludes: string[];
  conditions: OfferCondition[];
  charges: OfferCharge[];
  promos: OfferPromotion[];
  itinerary: string[];
  description: string;
  commercialMessage: string;
  sourceText: string;
  notes: string;
  internalPaymentPlan?: string;
  internalAssembly?: string;
  defaultForDestination?: boolean;
  priceConfirmed: boolean;
  availabilityConfirmed: boolean;
  updatedAt: string;
  publicNote: string;
  workbookKey?: string;
  sourceCampaignRow?: number;
  archived?: boolean;
  pilotEdited?: boolean;
  pilotReference?: Record<string, unknown>;
}

export interface OffersWorkspacePayload {
  version: number;
  offers: Offer[];
  removedPilotIds: string[];
  productoDefaults: Record<string, number>;
  workbookImports?: string[];
}
