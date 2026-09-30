import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextStore {
  requestId: string;
  userId?: string;
  userEmail?: string;
  ip?: string;
  method?: string;
  path?: string;
}

export const requestContextStorage =
  new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static get current(): RequestContextStore | undefined {
    return requestContextStorage.getStore();
  }

  static get requestId(): string | undefined {
    return this.current?.requestId;
  }

  static get userId(): string | undefined {
    return this.current?.userId;
  }

  static get userEmail(): string | undefined {
    return this.current?.userEmail;
  }

  static set(key: keyof RequestContextStore, value: any): void {
    const store = this.current;
    if (store) {
      store[key] = value;
    }
  }
}
