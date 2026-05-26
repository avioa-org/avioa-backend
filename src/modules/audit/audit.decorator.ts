import { SetMetadata } from '@nestjs/common';

export interface AuditConfig {
  action: string;
  entityType: string;
}

export const AUIDT_KEY = 'audit';
export const Audit = (config: AuditConfig) => SetMetadata(AUIDT_KEY, config);
