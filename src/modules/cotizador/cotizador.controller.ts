import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { CotizadorService } from './cotizador.service';
import { CotizadorDto } from './dto/cotizador.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ModulePermissionGuard } from 'src/common/guards/module-permission.guard';
import { RequireModule } from 'src/common/decorator/modules-permission.decorator';
import { Modules } from 'src/common/enum/modules.enum';

@UseGuards(JwtAuthGuard)
@Controller('cotizador')
export class CotizadorController {
  constructor(private readonly cotizadorService: CotizadorService) {}

  @Post('cotizar')
  cotizar(@Body() cotizadorDto: CotizadorDto) {
    return this.cotizadorService.cotizar(cotizadorDto);
  }

  @Get('estado/:jobId')
  estado(@Param('jobId') jobId: string) {
    return this.cotizadorService.estado(jobId);
  }

  @Get(':jobId/progress')
  progress(
    @Param('jobId') jobId: string,
    @Body() body: { percentage: number; message: string },
    @Headers('x-cotizador-secret') secret?: string,
  ) {
    return this.cotizadorService.progress(
      jobId,
      body.percentage,
      body.message,
      secret,
    );
  }
}
