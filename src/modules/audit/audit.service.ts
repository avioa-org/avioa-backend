import { Injectable, Scope } from '@nestjs/common';

export interface AuditDetails {
  description?: string;
  enitityId?: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
}

@Injectable({ scope: Scope.REQUEST })
export class AuditService {
  private details: AuditDetails = {};
  private skip = false;

  enrich(data: AuditDetails) {
    this.details = {
      ...this.details,
      ...data,
      changes: { ...this.details.changes, ...data.changes },
      metadata: { ...this.details.metadata, ...data.metadata },
    };
  }

  // Por si se quiere cancelar el log en algún caso puntual
  skipAudit() {
    this.skip = true;
  }

  getDetails(): AuditDetails {
    return this.details;
  }

  shouldSkip(): boolean {
    return this.skip;
  }
}
