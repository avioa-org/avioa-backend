import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { EventoPTDto } from 'src/common/dto/gmail-evento.dto';
import { envs } from 'src/config/env.config';
import OpenAI from 'openai';

@Injectable()
export class AlertaReservasService {
  private readonly logger = new Logger(AlertaReservasService.name);
  private readonly apiKey = envs.OPENAI_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  public async procesarReservas(alertaReservasDto: EventoPTDto) {
    const registro = await this.prisma.alertaReserva.findUnique({
      where: { threadId: alertaReservasDto.threadId },
    });

    if (!registro) {
      const { confianza, esReservaAvianca, razon } =
        await this.clasificadorEntrada(alertaReservasDto);

      const esReserva = esReservaAvianca && confianza >= 0.75;

      if (!esReserva) {
        this.logger.log(
          `Falso positivo entrada: "${alertaReservasDto.asunto}" - ${razon}`,
        );

        // this.prisma.alertaReserva.create({
        //   data: {
        //     threadId: alertaReservasDto.threadId,
        //     asunto: alertaReservasDto.asunto,
        //     cliente: alertaReservasDto.cliente,
        //   },
        // });
        return;
      }
    }

    const { confianza } = await this.clasificadorEntrada(alertaReservasDto);

    if (confianza < 0.5) return;

    const mensajesAAnalizar = !registro
      ? alertaReservasDto.todosLosMensajes
      : alertaReservasDto.mensajesNuevos;

    if (mensajesAAnalizar.length === 0) return;

    for (const msg of mensajesAAnalizar) {
      // 1. Validar por regex
      const emitido = [
        /(emit\w+(\s+por)?\s+avianca|emit\w+|egreso|emisi\w+)/i,
        /\b(emitir|emitido|emitida|emision|emisión|egreso)\b/i,
        /\bemitir\s+(por\s+)?avianca\b/i,
      ];
    }
  }

  private async clasificadorEntrada(evento: EventoPTDto) {
    const prompt = `Eres un asistente de una agencia de viajes colombiana.
Analiza el siguiente correo y determina si es una solicitud de reserva 
de tiquete o plan con Avianca específicamente.

Asunto: ${evento.asunto}
De: ${evento.cliente}
Mensaje: ${evento.cuerpoPrimerMensaje}

═══════════════════════════════════════
PREGUNTA: ¿Es este correo una solicitud de reserva de tiquete o plan con Avianca?
═══════════════════════════════════════

✅ SÍ es solicitud de reserva Avianca:
- El cuerpo empieza con "Cordial saludo" y contiene datos de pasajeros
- Dice "Solicitud reserva tiquete" o "Solicitud reserva plan" en el asunto o cuerpo
- Menciona vuelos con código AV (ej: AV 123, AV204)
- Menciona rutas operadas por Avianca (ej: BOG-MDE por Avianca)
- Tiene formato de solicitud: datos del pasajero, ruta, fecha, tarifa
- Menciona "Avianca" como aerolínea en el cuerpo o en el asunto del correo aunque sea en tabla de vuelos
- Puede tener imágenes de itinerarios con vuelos Avianca (mencionadas en texto)

❌ NO es solicitud de reserva Avianca:
- Es reserva con otra aerolínea exclusivamente (Latam, Copa, American, Wingo, etc.)
- Es un correo de pago, factura, confirmación o administrativo
- Es una respuesta o reenvío (Re:, Fwd:, RV:) sin solicitud nueva
- Menciona Avianca solo de pasada sin ser la aerolínea del tiquete
- No tiene formato de solicitud de reserva
- Es una pregunta o consulta sin datos de viaje

REGLAS CLAVE:
- Si el mensaje dice "Solicitud reserva tiquete" o "Solicitud reserva plan" 
  Y el cuerpo menciona Avianca o código AV → es SÍ con confianza alta
- Si tiene datos de pasajeros + vuelos AV → es SÍ aunque no diga "Avianca" explícito
- Ante la duda entre aerolíneas mixtas, si Avianca es UNA de ellas → es SÍ

Responde SOLO con JSON válido, sin texto adicional:
{"esReservaAvianca": true|false, "confianza": 0.0-1.0, "razon": "máximo 15 palabras"}`;

    return await this.enviarAOpenAI(prompt);
  }

  private async clasificador(cuerpo: string, asunto: string, apiKey: string) {}

  private async enviarAOpenAI(prompt: string): Promise<{
    esReservaAvianca: boolean;
    confianza: number;
    razon: string;
  }> {
    const client = new OpenAI({ apiKey: this.apiKey });

    try {
      const res = await client.responses.create({
        model: 'gpt-4o-mini',
        temperature: 0.0,
        max_output_tokens: 150,
        input: prompt,
        text: {
          format: {
            type: 'json_object',
          },
        },
      });

      const text = res.output_text;

      const clean = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      const parsed: {
        esReservaAvianca: boolean;
        confianza: number;
        razon: string;
      } = JSON.parse(clean);

      return parsed;
    } catch (error) {
      this.logger.error(`Error OpenAI: ${error?.['message']}`);
      return {
        esReservaAvianca: false,
        confianza: 0.0,
        razon: 'Error procesamiento OpenAI',
      };
    }
  }
}
