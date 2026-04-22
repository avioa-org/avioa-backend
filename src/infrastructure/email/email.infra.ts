import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { envs } from 'src/config/env.config';

interface IEmail {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inviteUrl?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly resend = new Resend(envs.RESEND_API_KEY as string);

  constructor() {}

  public async sendInvite(data: {
    to: string;
    subject: string;
    inviteUrl: string;
  }) {
    const { to, subject, inviteUrl } = data;

    try {
      const { data, error } = await this.resend.emails.send({
        from: envs.RESEND_FROM_EMAIL,
        to,
        subject,
        text: inviteUrl,
      });

      if (error) {
        this.logger.error(error);
        throw new Error(`Error al enviar email: ${error.message}`);
      }

      return data;
    } catch (error) {
      this.logger.error(error);
      throw new Error(
        `Error al enviar email: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      );
    }
  }
}
