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
  private readonly fromEmail = envs.RESEND_FROM_EMAIL;
  private readonly resend = new Resend(envs.RESEND_API_KEY);

  constructor() {}

  async send(to: string | string[], subject: string, html: string) {
    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Error enviando correo a ${to}: ${error}`);
    }
  }

  async sendTemplate(
    to: string | string[],
    templateId: string,
    variables: Record<string, string>,
  ) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,

        template: {
          id: templateId,
          variables,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(
        `Correo enviado correctamente a ${Array.isArray(to) ? to.join(', ') : to}`,
      );

      return data;
    } catch (error) {
      this.logger.error(`Error enviando template a ${to}: ${error}`);
    }
  }

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
