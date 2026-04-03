import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

export type ResultadoClasificacion =
  | { intencion: 'SOLICITUD_PAGO'; confianza: number; razon: string }
  | { intencion: 'CONFIRMACION_PAGO'; confianza: number; razon: string }
  | { intencion: 'OTRO'; confianza: number; razon: string };

@Injectable()
export class PagoTotalClasificadorService {
  private readonly logger = new Logger(PagoTotalClasificadorService.name);

  public mencionaPagoTotal(cuerpo: string): boolean {
    return /pago\s+total/i.test(cuerpo);
  }

  public async clasificarIntencion(
    cuerpo: string,
    asunto: string,
    apiKey: string,
  ): Promise<ResultadoClasificacion> {
    const client = new OpenAI({ apiKey: apiKey });

    const prompt = `Eres un asistente de una agencia de viajes colombiana. Analiza el siguiente mensaje de correo de un cliente y clasifica su intención respecto a "pago total".

Asunto: ${asunto}
Mensaje: ${cuerpo.substring(0, 1000)}

Clasifica en UNA de estas categorías:
- SOLICITUD_PAGO: el cliente solicita o autoriza que se realice el pago total de su reserva
- CONFIRMACION_PAGO: el cliente confirma que ya realizó el pago total (adjunta comprobante, dice que ya pagó, etc.)
- OTRO: menciona "pago total" pero no es ninguno de los anteriores (pregunta, negación, cita de mensaje anterior). Si menciona solo "pago total"

Responde SOLO con JSON válido, sin texto adicional:
{"intencion": "SOLICITUD_PAGO|CONFIRMACION_PAGO|OTRO", "confianza": 0.0-1.0, "razon": "máximo 15 palabras"}`;

    try {
      const res = await client.responses.create({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_output_tokens: 80,
        input: prompt,
      });

      const text = res.output_text;
      const parsed: ResultadoClasificacion = JSON.parse(text);

      return parsed;
    } catch (error) {
      this.logger.error(`Error OpenAI: ${error.message}`);

      return {
        intencion: 'OTRO',
        confianza: 0,
        razon: 'error procesamiento',
      };
    }
  }
}
