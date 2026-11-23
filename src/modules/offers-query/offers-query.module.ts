import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/infrastructure/prisma/prisma.module';
import { OffersQueryService } from './offers-query.service';
import { OffersApiGuard } from './offers-api.guard';
import { OffersApiController } from './offers-api.controller';
@Module({ imports: [PrismaModule], controllers: [OffersApiController], providers: [OffersQueryService, OffersApiGuard], exports: [OffersQueryService] })
export class OffersQueryModule {}
