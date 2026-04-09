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
    if (!this.mencionaPagoTotal(cuerpo)) {
      return {
        intencion: 'OTRO',
        confianza: 1.0,
        razon: 'no menciona pago total',
      };
    }

    const client = new OpenAI({ apiKey: apiKey });

    //     const prompt = `Eres un asistente de una agencia de viajes colombiana.
    // Analiza el siguiente mensaje y clasifica su intención respecto a "pago total".

    // Asunto: ${asunto}
    // Mensaje: ${cuerpo.substring(0, 1000)}

    // CATEGORÍAS (elige UNA):

    // CONFIRMACION_PAGO → el mensaje indica que un pago total YA fue realizado o está siendo registrado.
    // Ejemplos que SÍ son confirmación:
    // - "ingresa pago total"
    // - "ingreso pago total"
    // - "buen día, ingresa pago total"
    // - "pago total realizado"
    // - "ya pagué el total"
    // - "adjunto comprobante pago total"
    // - Cualquier frase que registre o confirme la entrada de un pago total

    // SOLICITUD_PAGO → se solicita o autoriza realizar el pago total (aún no ocurrió).
    // Ejemplos:
    // - "favor procesar con pago total"
    // - "pago total a inversiones"
    // - "autorizo pago total"

    // OTRO → cualquier otro uso de "pago total" que NO sea confirmación ni solicitud.
    // Ejemplos que NO aplican:
    // - "Ingreso: $8.000.000" en formato de reserva (es el valor de venta)
    // - "Medio de pago: TRANSFERENCIA" (es info de reserva)
    // - Correos con formato INFORMACIÓN PASAJEROS / VUELOS / ALOJAMIENTO
    // - Preguntas sobre pago total
    // - Negaciones

    // REGLA CLAVE: Si el mensaje es corto, directo y dice "ingresa/ingreso pago total/pago total",
    // es SIEMPRE CONFIRMACION_PAGO con confianza 1.0.

    // REGLA CRÍTICA:
    // Si el mensaje NO contiene explícitamente la frase "pago total",
    // DEBES responder siempre:
    // {"intencion": "OTRO", "confianza": 1.0, "razon": "no menciona pago total"}. NO infieras, NO asumas, NO relaciones el contenido con pagos.

    // Responde SOLO con JSON válido:
    // {"intencion": "SOLICITUD_PAGO|CONFIRMACION_PAGO|OTRO", "confianza": 0.0-1.0, "razon": "máximo 15 palabras"}`;

    const prompt = `Eres un asistente de una agencia de viajes colombiana. 
Analiza el siguiente mensaje y clasifica su intención respecto a "pago total".

Asunto: ${asunto}
Mensaje: ${cuerpo.substring(0, 1000)}

CATEGORÍAS (elige UNA):

CONFIRMACION_PAGO → El mensaje indica que se debe registrar o ya se está registrando un **pago total** (totalidad de la reserva). 
Incluye casos donde la persona está pidiendo que se ingrese/abone/registre el pago total.
Ejemplos que SÍ son CONFIRMACION_PAGO:
- "ingresa pago total"
- "ingreso pago total"
- "abono de $300.000 PAGO TOTAL"
- "solicito abono de pago total"
- "solicito registrar pago total"
- "favor ingresar pago total"
- "adjunto comprobante pago total"
- "ya pagué el total" / "pago total realizado"

SOLICITUD_PAGO → Se solicita o autoriza hacer el pago total (aún no ha ocurrido, es una instrucción de pago hacia el cliente o proveedor).

OTRO → Cualquier otro caso.

REGLAS IMPORTANTES:

1. Si el mensaje contiene **"PAGO TOTAL"** (en mayúsculas o no) y menciona una cantidad de dinero + medio de pago para una reserva, casi siempre es CONFIRMACION_PAGO.

2. Frases como "solicito abono", "solicito ingresar", "favor abonar", "registrar pago total" **deben clasificarse como CONFIRMACION_PAGO**.

3. REGLA CLAVE: Mensajes cortos y directos que digan "pago total" junto con monto y medio de pago → CONFIRMACION_PAGO con alta confianza.

4. REGLA CRÍTICA: 
Si el mensaje NO contiene las palabras "pago total" o "pago completo", 
responde siempre:
{"intencion": "OTRO", "confianza": 1.0, "razon": "no menciona pago total"}

Responde SOLO con JSON válido:
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
      this.logger.error(`Error OpenAI: ${error?.['message']}`);

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
      /ingres[oa]\s+pago\s+total/i,
      /ingres[oa]\s+(de\s+)?[\d\$\.,]+.*pago\s+total/i,
      /ingreso[\s:]+\$?[\d\.,]+\s+pago\s+total/i,
      /pago\s+total\s+realizado/i,
      /confirmo\s+(el\s+)?pago\s+total/i,
      /pago\s+total\s+completo/i,
      /ya\s+(hice|realicé|realizé|hizo|realizó)\s+(el\s+)?pago\s+total/i,
      /pago\s+total[\s\n]+\d{6,}/,
      /pago\s+total[\s\n]+\$[\d\.,]+/i,
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
      /^\s*pago\s+total\s*$/im,
      /pago\s+total[\s\n]*(adjunto|comprobante)/i,
      /pago\s+total[\s\n]+[a-z0-9]{6,}/i,
    ];

    if (certezaMedia.some((r) => r.test(cuerpo))) {
      return null;
    }

    return {
      intencion: 'OTRO',
      confianza: 1.0,
      razon: 'no coincide con patrones',
    };
  }
}
