import type { CreateLeaveDto } from '../leaves/dto/create-leave.dto';
import { LeaveStatus } from 'generated/prisma/enums';

export type AssistantActionPayload =
  | { kind: 'CREATE_LEAVE'; input: CreateLeaveDto }
  | { kind: 'CANCEL_LEAVE'; requestId: string }
  | {
      kind: 'REVIEW_LEAVE';
      requestId: string;
      status: Extract<LeaveStatus, 'APPROVED' | 'REJECTED'>;
      comment?: string;
    };

export interface PendingAssistantAction {
  actionId: string;
  actorId: string;
  threadId: string;
  payload: AssistantActionPayload;
  summary: string;
  expiresAt: number;
  state: 'PENDING' | 'EXECUTING';
}

export type ProposeAssistantAction = (
  actorId: string,
  threadId: string,
  payload: AssistantActionPayload,
  summary: string,
) => Promise<PendingAssistantAction>;
