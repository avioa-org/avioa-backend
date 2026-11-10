import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { envs } from 'src/config/env.config';
import OpenAI from 'openai';
import { COMMERCIAL_EMAIL_SYSTEM_PROMPT } from './commercial-email.prompt';
import { randomUUID } from 'crypto';

export interface EmailResponse {
  answer: string;
  subject: string;
  body: string;
}

@Injectable()
export class CommercialEmailService {
  private readonly logger = new Logger(CommercialEmailService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(private readonly prisma: PrismaService) {
    this.openai = new OpenAI({ apiKey: envs.OPENAI_API_KEY });
    this.model = envs.OPENAI_MODEL ?? 'gpt-4o-mini';
  }

  async generateEmail(
    userId: string,
    threadId: string | undefined,
    requestId: string | undefined,
    message: string,
  ) {
    const realRequestId = requestId?.trim() || randomUUID();
    const realThreadId = threadId?.trim() || randomUUID();
    const started = Date.now();

    try {
      // 1. Buscar historial de los últimos 6 mensajes exitosos en el hilo
      // Nota: Como no tenemos tabla para esto, usaremos una consulta a los logs 
      // o simplemente enviaremos el historial desde el frontend (si se envía).
      // En este caso, para replicar el comportamiento del original, lo ideal es guardar el historial.
      // Si no tienes una tabla, el historial se maneja en el frontend (como lo hace el componente actual).
      
     

      
      const messages: any[] = [];
      
      // Si en el futuro quieres cargar historial desde BD, aquí iría la consulta.
      // messages.push(...);

      messages.push({ role: 'user', content: message });

      // 2. Llamar a OpenAI con el formato JSON estructurado
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.4, // Un poco más de creatividad para redacción, a diferencia de cotizaciones
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'email_response',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                answer: { type: 'string', maxLength: 6000 },
                subject: { type: 'string', maxLength: 500 },
                body: { type: 'string', maxLength: 12000 },
              },
              required: ['answer', 'subject', 'body'],
              additionalProperties: false,
            },
          },
        },
        messages: [
          { role: 'system', content: COMMERCIAL_EMAIL_SYSTEM_PROMPT },
          ...messages,
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw) as EmailResponse;

      return {
        requestId: realRequestId,
        threadId: realThreadId,
        answer: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err: any) {
      this.logger.error(`Error generando correo: ${err?.message ?? err}`, err?.stack);
      throw new InternalServerErrorException(
        'Error procesando la solicitud de correo. Intenta nuevamente.',
      );
    }
  }
}