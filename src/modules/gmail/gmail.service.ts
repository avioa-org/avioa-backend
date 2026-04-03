import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { envs } from 'src/config/env.config';
import { ProcesarPagoTotalDto } from './dto/gmai.dto';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client = new google.auth.OAuth2(
    envs.googleClientId,
    envs.googleClientSecret,
    envs.googleRedirectUri,
  );

  getAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
    });
  }

  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.logger.log('✅ Tokens obtenidos:');
    console.log(tokens);

    return tokens;
  }

  async procesarPagoTotal(procesarPagoTotalDto: ProcesarPagoTotalDto) {
    const { threadId, subject, from, date, body } = procesarPagoTotalDto;

    // this.logger.debug({
    //   threadId,
    //   subject,
    //   from,
    //   date,
    //   body,
    // });

    const mensajeNuevo = this.extraerMensajeNuevo(body);
    this.logger.debug(this.esPagoTotalConfirmado(mensajeNuevo));
  }

  private extraerMensajeNuevo(body: string) {
    if (!body) return '';

    let limpio = body;

    const delimitadores = [
      /el\s.+?escribió:/i,
      /on\s.+?wrote:/i,
      /de:\s.+/i,
      /from:\s.+/i,
      /-----original message-----/i,
      /\n>+/g,
    ];

    for (const regex of delimitadores) {
      const match = limpio.search(regex);
      if (match !== -1) {
        limpio = limpio.substring(0, match);
      }
    }

    return limpio
      .replace(/\[image:.*?\]/gi, '') // elimina imágenes
      .replace(/\s+/g, ' ') // normaliza espacios
      .trim();
  }

  private esPagoTotalConfirmado(body: string) {
    if (!body.includes('pago total')) return false;
    if (/\bsolicito\b.*\bpago\s+total\b/i.test(body)) return true;

    const confirmaciones = [
      /\b(por\s+favor\s+)?pago\s+total\b/i,
      /\bpago\s+total\s+de\s+la\s+reserva\b/i,
      /\bpago\s+total\b.*\$\s*\d+/i,
      /\b(hice|realicé|realizé|hizo|realizó)\s+el\s+pago\s+total\b/i,
      /\bya\s+(hice|realicé|realizé|hizo|realizó|hacer)\s+(el\s+)?pago\s+total\b/i,
      /\bpago\s+total\s+(realizado|hecho|completo|efectuado)\b/i,
      /\b(adjunto|envío|envio)\s+.*pago\s+total\b/i,
      /\bel\s+pago\s+total\s+(fue|queda|quedó)\s+(hecho|realizado|completo)\b/i,
      /\bcomprobante\s+(de|del)\s+pago\s+total\b/i,
      /\bse\s+(hizo|realizó|completó)\s+el\s+pago\s+total\b/i,
      /\bconfirmo\s+(el\s+)?pago\s+total\b/i,
      /\*\s*(ingreso|pago)[\s:]+.*\bpago\s+total\b/i,
      /\bingreso[\s:]+\$?[\d\.,]+\s+pago\s+total\b/i,
      /\bingres(a|o|ó)\s+(el\s+)?pago\s+total\b/i,
      /^\s*pago\s+total\s*$/i,
      /\b(proceder|hacer|realizar)\s+(con\s+)?(el\s+)?pago\s+total\b/i,
      /\bpor\s+favor\s+(proceder|hacer|realizar)\s+(con\s+)?(el\s+)?pago\s+total\b/i,
      /\bproceder\s+(a\s+)?hacer\s+(el\s+)?pago\s+total\b/i,
    ];

    for (const p of confirmaciones) {
      if (p.test(body)) return true;
    }
    return false;
  }
}
