import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { envs } from 'src/config/env.config';

type GmailReplyPayload = {
  threadId?: string;
  thread_id?: string;
  messageId?: string;
  message_id?: string;
  from?: string;
  body?: string;
  rawBody?: string;
  raw_body?: string;
  text?: string;
  receivedAt?: string;
  received_at?: string;
};

@Controller('webhooks/gmail-webhook')
export class GmailWebhookController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('reply')
  @HttpCode(HttpStatus.OK)
  async handleReply(
    @Body() dto: GmailReplyPayload,
    @Headers('x-webhook-secret') secret: string,
  ) {
    const expected = envs.GMAIL_WEBHOOK_SECRET;

    console.log('body webhook', dto);

    if (!expected || secret !== expected) throw new UnauthorizedException();

    const threadId = dto.threadId ?? dto.thread_id;
    const messageId = dto.messageId ?? dto.message_id;
    if (!threadId || !messageId)
      return { ok: false, error: 'threadId/messageId requeridos' };

    const dup = await this.prisma.operationalTransferVoucherReplies.findUnique({
      where: { message_id: messageId },
    });

    if (dup) return { ok: true, duplicated: true };

    const voucher = await this.prisma.operationalTransferVouchers.findFirst({
      where: { thread_id: threadId, deleted_at: null },
    });

    if (!voucher) return { ok: true, ignored: true };

    const at = new Date().toISOString();

    try {
      await this.prisma.$transaction([
        this.prisma.operationalTransferVoucherReplies.create({
          data: {
            id: randomUUID(),
            voucher_id: voucher.id,
            thread_id: threadId,
            message_id: messageId,
            from_email: dto.from ?? '',
            body: dto.body ?? dto.text ?? '',
            raw_body:
              dto.rawBody ?? dto.raw_body ?? dto.body ?? dto.text ?? null,
            received_at: dto.receivedAt ?? dto.received_at ?? at,
            created_at: at,
          },
        }),
        this.prisma.operationalTransferVouchers.update({
          where: { id: voucher.id },
          data: {
            reply_count: { increment: 1 },
            last_reply_at: dto.receivedAt ?? dto.received_at ?? at,
            updated_at: at,
          },
        }),
      ]);
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002')
        return { ok: true, duplicated: true };
      throw e;
    }

    return { ok: true };
  }
}
