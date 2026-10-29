import { AsyncLocalStorage } from 'node:async_hooks';
import { type SqlDatabase } from './postgres.repository';
export interface ObjectStore {
  put(key: string, bytes: Uint8Array, options?: unknown): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<unknown>;
}

export interface OperationalRuntime {
  DB: SqlDatabase;
  BUCKET: ObjectStore;
  VAULT_ENCRYPTION_KEY: string;
  TRANSFER_RESEND_API_KEY?: string;
  TRANSFER_EMAIL_ENABLED?: string;
  actor: string;
  name: string;
  canWrite: boolean;
}
export const requestContext = new AsyncLocalStorage<OperationalRuntime>();
export function getRuntime() {
  const value = requestContext.getStore();
  if (!value) throw Error('Missing authorized auxiliary context');
  return value;
}
