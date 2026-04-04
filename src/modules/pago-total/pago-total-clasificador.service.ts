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
    return /pago\s+total|ingreso.*pago|pago.*ingreso/i.test(cuerpo);
  }

  public async clasificarIntencion(
    cuerpo: string,
    asunto: string,
    apiKey: string,
  ): Promise<ResultadoClasificacion> {
    const client = new OpenAI({ apiKey: apiKey });

    const prompt = `Eres un asistente de una agencia de viajes colombiana. Analiza el siguiente mensaje de correo y clasifica su intención respecto a "pago total".

Asunto: ${asunto}
Mensaje: ${cuerpo.substring(0, 1000)}

Clasifica en UNA de estas categorías:
- SOLICITUD_PAGO: se solicita o autoriza realizar el pago total de una reserva (ej: "pago total a inversiones", "favor procesar con pago total")
- CONFIRMACION_PAGO: el cliente o asesor confirma que el pago total YA fue realizado (adjunta comprobante, dice "ya pagué", "pago realizado")
- OTRO: cualquier otro uso de "pago total" (preguntas, negaciones, citas de mensajes anteriores, menciones incidentales)

Responde SOLO con JSON válido, sin texto adicional:
{"intencion": "SOLICITUD_PAGO|CONFIRMACION_PAGO|OTRO", "confianza": 0.0-1.0, "razon": "máximo 15 palabras"}`;

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

      const parsed: ResultadoClasificacion = JSON.parse(clean);
      this.logger.debug(`Clasificación OpenAI: ${JSON.stringify(parsed)}`);

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

  public clasificarPorRegex(cuerpo: string): ResultadoClasificacion | null {
    // Alta certeza — no necesitan OpenAI
    const altaCerteza = [
      /ingreso\s+pago\s+total/i,
      /ingreso[\s:]+\$?[\d\.,]+\s+pago\s+total/i,
      /pago\s+total\s+realizado/i,
      /confirmo\s+(el\s+)?pago\s+total/i,
      /pago\s+total\s+completo/i,
      /ya\s+(hice|realicé|realizé|hizo|realizó)\s+(el\s+)?pago\s+total/i,
      /pago\s+total[\s\n]+\d{6,}/, // "pago total" + número de referencia
      /pago\s+total[\s\n]+\$[\d\.,]+/i, // "pago total" + monto
    ];

    if (altaCerteza.some((r) => r.test(cuerpo))) {
      return {
        intencion: 'CONFIRMACION_PAGO',
        confianza: 1.0,
        razon: 'patrón directo detectado',
      };
    }

    // Certeza media — mandar a OpenAI
    const certezaMedia = [
      /^\s*pago\s+total\s*$/im, // solo "pago total" en una línea
      /pago\s+total[\s\n]*(adjunto|comprobante)/i,
      /pago\s+total[\s\n]+[a-z0-9]{6,}/i, // "pago total" + código alfanumérico
    ];

    if (certezaMedia.some((r) => r.test(cuerpo))) {
      return null; // no es confirmación segura, pero sí relevante para analizar con OpenAI
    }

    return {
      intencion: 'OTRO',
      confianza: 1.0,
      razon: 'no coincide con patrones',
    };
  }
}
