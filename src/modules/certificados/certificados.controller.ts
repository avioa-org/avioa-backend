import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CertificadosService } from './certificados.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { LegalEntity } from '../admin/users/enum/legal-entity.enum';

@Controller('certificados')
@UseGuards(JwtAuthGuard)
export class CertificadosController {
  constructor(private readonly certificadosService: CertificadosService) {}

  @Post('certificado-laboral')
  generateLaboralCertificate(
    @CurrentUser('userId') userId: string,
    @Body() legalEntity?: { legalEntity?: LegalEntity },
  ) {
    return this.certificadosService.requestLaboralCertificate(
      userId,
      legalEntity ?? {},
      userId,
    );
  }

  @Get('jobs/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    return this.certificadosService.getJobStatus(jobId);
  }
}
