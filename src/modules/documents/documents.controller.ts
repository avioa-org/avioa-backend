import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    return await this.documentsService.uploadDocument(file);
  }

  @Get()
  async getAllTemplates() {
    return await this.documentsService.getAllTemplates();
  }

  @Get(':templateId')
  async getOneTemplate(@Param('templateId') templateId: string) {
    return await this.documentsService.getOneTemplate(templateId);
  }
}
