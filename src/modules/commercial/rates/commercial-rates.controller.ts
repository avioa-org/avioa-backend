// src/modules/commercial/rates/commercial-rates.controller.ts
import { Controller, Get, Post, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CommercialRatesService } from './commercial-rates.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('commercial/rates')
@UseGuards(JwtAuthGuard)
export class CommercialRatesController {
  constructor(private readonly service: CommercialRatesService) {}

  @Get('list')
  listTables() { return this.service.listTables(); }

  @Get(':slug')
  getTable(@Param('slug') slug: string) { return this.service.getTable(slug); }

  @Post('create')
  createTable(@Body() body: { title: string; slug: string; year: number; type: string }) {
    return this.service.createTable(body.title, body.slug, body.year, body.type);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('source') source: string,
  ) {
    if (!file) throw new BadRequestException('No se envió archivo.');
    if (!source) throw new BadRequestException('Falta el parámetro source.');
    return this.service.importFromExcel(file.buffer, source);
  }

  @Post(':tableId/rows')
  addRow(@Param('tableId') tableId: string, @Body() body: any) {
    return this.service.addRow(tableId, body);
  }

  @Delete(':tableId/rows/:rowIndex')
  deleteRow(@Param('tableId') tableId: string, @Param('rowIndex') rowIndex: string) {
    return this.service.deleteRow(tableId, Number(rowIndex));
  }
}