import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { envs } from 'src/config/env.config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail = envs.RESEND_FROM_EMAIL;
  private readonly resend = new Resend(envs.RESEND_API_KEY);

  async send(to: string | string[], subject: string, html: string) {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    try {
      if (envs.NODE_ENV === 'development') {
        this.logger.log(
          `[DEV MODE] Sending email "${subject}" redirecting from [${recipients}] to dev inbox`,
        );
        const { data, error } = await this.resend.emails.send({
          from: this.fromEmail,
          to: 'apoyotecnologia02@gmail.com',
          subject: `[DEV to ${recipients}] ${subject}`,
          html,
        });
        if (error) {
          this.logger.error(
            `Failed sending email in DEV mode to ${recipients}: ${error.message}`,
          );
        } else {
          this.logger.log(`Email sent in DEV mode (id: ${data?.id})`);
        }
        return data;
      }

      this.logger.log(`Sending email "${subject}" to [${recipients}]`);
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(
          `Resend API error sending email to ${recipients}: ${error.message}`,
        );
        throw new Error(error.message);
      }

      this.logger.log(
        `Email successfully sent to [${recipients}] (id: ${data?.id})`,
      );
      return data;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send email to ${recipients}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  async sendTemplate(
    to: string | string[],
    templateId: string,
    variables: Record<string, string>,
  ) {
    const recipients = Array.isArray(to) ? to.join(', ') : to;
    try {
      this.logger.log(
        `Sending email template [${templateId}] to [${recipients}]`,
      );
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        template: {
          id: templateId,
          variables,
        },
      });

      if (error) {
        this.logger.error(
          `Resend template error for ${recipients}: ${error.message}`,
        );
        throw new Error(error.message);
      }

      this.logger.log(
        `Email template [${templateId}] sent to [${recipients}] (id: ${data?.id})`,
      );

      return data;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Error sending template ${templateId} to ${recipients}: ${err.message}`,
        err.stack,
      );
      throw error;
    }
  }

  public async sendInvite(data: {
    to: string;
    subject: string;
    inviteUrl: string;
  }) {
    const { to, subject, inviteUrl } = data;

    try {
      this.logger.log(`Sending invite email to [${to}]`);
      const { data: resData, error } = await this.resend.emails.send({
        from: envs.RESEND_FROM_EMAIL,
        to,
        subject,
        text: inviteUrl,
      });

      if (error) {
        this.logger.error(`Resend invite error to ${to}: ${error.message}`);
        throw new Error(`Error al enviar email: ${error.message}`);
      }

      this.logger.log(`Invite email sent to [${to}] (id: ${resData?.id})`);
      return resData;
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to send invite email to ${to}: ${err.message}`,
        err.stack,
      );
      throw new Error(
        `Error al enviar email: ${err.message || 'Error desconocido'}`,
      );
    }
  }
}
