import {
  All,
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';
import { AuxiliaryOperationalService } from './auxiliary-operational.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
@Controller('auxiliary-operational')
@UseGuards(JwtAuthGuard, ModulePermissionGuard)
@RequireModule(Modules.AUXILIARY)
export class AuxiliaryOperationalController {
  constructor(
    private readonly service: AuxiliaryOperationalService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':voucherId/replies')
  async list(@Param('voucherId') voucherId: string) {
    const voucher = await this.prisma.operationalTransferVouchers.findUnique({
      where: { id: voucherId },
      select: {
        id: true,
        thread_id: true,
        reply_count: true,
        last_reply_at: true,
        deleted_at: true,
      },
    });

    if (!voucher || voucher.deleted_at) throw new NotFoundException();

    const replies =
      await this.prisma.operationalTransferVoucherReplies.findMany({
        where: { voucher_id: voucher.id },
        orderBy: { received_at: 'asc' },
        select: {
          id: true,
          message_id: true,
          from_email: true,
          body: true,
          received_at: true,
        },
      });

    return {
      voucher: {
        id: voucher.id,
        threadId: voucher.thread_id,
        replyCount: voucher.reply_count,
        lastReplyAt: voucher.last_reply_at,
      },
      replies: replies.map((r) => ({
        id: r.id,
        messageId: r.message_id,
        from: r.from_email,
        body: r.body,
        receivedAt: r.received_at,
      })),
    };
  }

  @Get(':voucherId/replies/:replyId/raw')
  async raw(
    @Param('voucherId') voucherId: string,
    @Param('replyId') replyId: string,
  ) {
    const reply = await this.prisma.operationalTransferVoucherReplies.findFirst(
      {
        where: { id: replyId, voucher_id: voucherId },
        select: { id: true, raw_body: true, body: true, received_at: true },
      },
    );

    if (!reply) throw new NotFoundException();

    return {
      id: reply.id,
      receivedAt: reply.received_at,
      rawBody: reply.raw_body ?? reply.body,
    };
  }

  @All(['', '*path'])
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        files: 10,
        fileSize: 8 * 1024 * 1024,
        fields: 5,
        fieldSize: 2000000,
      },
    }),
  )
  async dispatch(
    @Req() req: Request,
    @Res() res: Response,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parameter = req.params.path;
    const path = Array.isArray(parameter)
      ? parameter.join('/')
      : String(parameter || '');
    const result = await this.service.handle(req, files || [], path);
    res.status(result.status);
    result.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await result.arrayBuffer()));
  }
}
