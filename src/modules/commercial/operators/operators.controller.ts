import { Controller, Get, Post, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile, Query, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OperatorsService } from './operators.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('commercial/operators')
@UseGuards(JwtAuthGuard)
export class OperatorsController {
  constructor(private readonly service: OperatorsService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importExcel(
    @UploadedFile() file: Express.Multer.File,
    @Query('category') category: string,
  ) {
    if (!file) throw new BadRequestException('No se envió archivo.');
    return this.service.importFromExcel(file.buffer, category);
  }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.service.delete(id); }
}