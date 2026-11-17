// // src/modules/commercial/commercial-drive-tables.controller.ts
// import { Controller, Get, Post, Query, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { memoryStorage } from 'multer';
// import { CommercialDriveTablesService } from './commercial-drive-tables.service';

// @Controller('commercial/drive-tables')
// export class CommercialDriveTablesController {
//   constructor(private readonly service: CommercialDriveTablesService) {}

//   @Get()
//   async getTable(@Query('source') source: string) {
//     return this.service.getTable(source);
//   }

//   // NUEVO ENDPOINT: Importar Excel y guardar en BD
//   @Post('import')
//   @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
//   async importTable(
//     @UploadedFile() file: Express.Multer.File,
//     @Query('source') source: string, // ej: 'baja2026'
//   ) {
//     if (!file) throw new BadRequestException('Sube un archivo Excel.');
    
//     // Llamamos al método que hace el parseo y guarda en Prisma
//     return this.service.importFromExcel(file.buffer, source);
//   }
// }