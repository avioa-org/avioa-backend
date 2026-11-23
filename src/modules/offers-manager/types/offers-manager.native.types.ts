export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type JsonObject = Record<string, JsonValue>;

export interface OffersPayload extends JsonObject {
  offers: OfferRecord[];
  productoDefaults?: JsonObject;
  [key: string]: JsonValue;
}

export interface OfferRecord extends JsonObject {
  id: string;
  [key: string]: JsonValue;
}

export interface OffersWorkspaceSnapshot {
  id: 1;
  revision: number;
  payload: OffersPayload;
  updatedAt: string;
}

export interface OffersHistoryEntry {
  revision: number;
  actor: string;
  actorId: string;
  action: string;
  createdAt: string;
  payload: OffersPayload;
  summary: string;
}

export interface OffersSession {
  userId: string;
  email: string;
  role: 'editor' | 'approver';
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface SaveOffersPayloadRequest {
  payload: OffersPayload;
  expectedRevision: number;
}

export interface OffersNativeResult<T> {
  ok: true;
  data: T;
}
