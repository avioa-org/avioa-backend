import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';

@Controller('documents')
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
