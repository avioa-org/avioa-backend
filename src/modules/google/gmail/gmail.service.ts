import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { google } from 'googleapis';
import { envs } from 'src/config/env.config';
import { EvolutionApiService } from 'src/infrastructure/evolution-api/evolution-api.service';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

interface ITrheadMessages {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    body: { data: string };
    parts: Array<{ partId: string; mimeType: string; filename: string }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  private gmail;

  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly prisma: PrismaService,
    @InjectQueue('hotel-payment-alerts') private readonly queue: Queue,
  ) {
    const auth = new google.auth.OAuth2(
      envs.GOOGLE_CLIENT_ID,
      envs.GOOGLE_CLIENT_SECRET,
      envs.GOOGLE_REDIRECT_URI,
    );

    auth.setCredentials({
      refresh_token: envs.GOOGLE_REFRESH_TOKEN,
    });

    this.gmail = google.gmail({
      version: 'v1',
      auth,
    });
  }

  private readonly VALID_SUBJECT_PATTERNS: RegExp[] = [
    /HOTEL\s+PAGO\s+INMEDIATO/i,
    /PAGO\s+HOTEL\s+INMEDIATO/i,
    /INMEDIATO\s+PAGO\s+HOTEL/i,
    /PAGO\s+INMEDIATO\s+HOTEL/i,
  ];

  private isValidSubject(subject: string): boolean {
    return this.VALID_SUBJECT_PATTERNS.some((pattern) => pattern.test(subject));
  }

  async scan() {
    this.logger.log('Escaneandoo correos PAGO/HOTEL/INMEDIATO...');

    const res = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults: 20,
      q: 'is:unread in:inbox subject:("HOTEL PAGO INMEDIATO" OR "PAGO HOTEL INMEDIATO" OR "INMEDIATO PAGO HOTEL" OR "PAGO INMEDIATO HOTEL")',
    });

    const messages = res.data.messages ?? [];
    this.logger.log(`${messages.length} correos candidatos encontrados`);

    for (const message of messages) {
      try {
        await this.processThread(message.threadId! as string);
      } catch (err) {
        this.logger.error(
          `Error procesando thread ${message.threadId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }
  }

  private async processThread(threadId: string) {
    const thread = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
    });

    const threadMessages = thread.data.messages ?? [];
    if (threadMessages.length === 0) return;

    const firstMessage = threadMessages[0];

    const subject =
      firstMessage.payload?.headers?.find((h) => h.name === 'Subject')?.value ??
      '(sin asunto)';

    if (!this.isValidSubject(subject as string)) {
      this.logger.debug(
        `Subject no cumple el patrón exacto, se descarta: "${subject}"`,
      );
      return;
    }

    const emailReceivedAt = new Date(Number(firstMessage.internalDate));

    let record = await this.prisma.hotelImmediatePayment.findUnique({
      where: { threadId },
    });

    if (!record) {
      record = await this.prisma.hotelImmediatePayment.create({
        data: {
          threadId,
          subject,
          emailReceivedAt,
          notificationLevel: 0,
          answered: false,
        },
      });

      this.logger.log(`Nuevo hilo registrado: ${threadId} - "${subject}"`);
    }

    if (record.answered) return;

    if (this.isThreadAnswered(threadMessages as ITrheadMessages[])) {
      await this.prisma.hotelImmediatePayment.update({
        where: { threadId },
        data: { answered: true },
      });
      this.logger.log(`Hilo ${threadId} respondido, se detiene alertas`);
    }

    const dueLevel = this.getDueLevel(
      record.emailReceivedAt,
      record.notificationLevel,
    );

    console.log('dueLevel', dueLevel);

    if (dueLevel) {
      await this.enqueueAlert(
        record.threadId,
        dueLevel,
        record.subject as string,
      );
    }
  }

  private isThreadAnswered(messages: ITrheadMessages[]): boolean {
    return messages.some((m) => m.labelIds?.includes('SENT'));
  }

  private getDueLevel(
    emailReceivedAt: Date,
    currentLevel: number,
  ): number | null {
    if (currentLevel === 3) return null;

    const delays: Record<number, number> = {
      1: 0,
      2: 15,
      3: 30,
    };

    const nextLevel = currentLevel + 1;
    const elapsedMinutes = (Date.now() - emailReceivedAt.getTime()) / 60000;

    return elapsedMinutes >= delays[nextLevel] ? nextLevel : null;
  }

  async getHotelsWithInmediatePayments() {
    const res = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'is:unread in:inbox subject:PAGO subject:HOTEL subject:INMEDIATO',
    });

    const messages = res.data.messages ?? [];

    const noAtendidos: {
      id: string;
      threadId: string;
      subject: string;
      fechaCorreo: Date;
    }[] = [];

    for (const message of messages) {
      const thread = await this.gmail.users.threads.get({
        userId: 'me',
        id: message.threadId!,
      });

      if ((thread.data.messages?.length ?? 0) === 1) {
        const firstMessage = thread.data.messages![0];

        const subject = firstMessage.payload?.headers?.find(
          (h) => h.name === 'Subject',
        )?.value;

        noAtendidos.push({
          id: message.id,
          threadId: message.threadId,
          subject,
          fechaCorreo: firstMessage.internalDate!,
        });
      }
    }

    return noAtendidos;
  }

  private async enqueueAlert(threadId: string, level: number, subject: string) {
    const jobId = `${threadId}-alert-${level}`;

    await this.queue.add(
      'send-alert',
      { threadId, subject, level },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`Alerta nivel ${level} encolada para ${threadId}`);
  }

  // async notifyHotelsWithInmediatePayments() {
  //   if (!this.evolutionApi.instanciaActiva) {
  //     this.logger.warn('Evolution API no disponible');
  //     return;
  //   }

  //   const noAtendidos = await this.getHotelsWithInmediatePayments();

  //   for (const noAtendido of noAtendidos) {
  //     const dbMessage = await this.prisma.hotelImmediatePayment.findFirst({
  //       where: { threadId: noAtendido.threadId },
  //     });

  //     if (!dbMessage) {
  //       // await this.prisma.hotelImmediatePayment.create({
  //       //   data: {
  //       //     threadId: noAtendido.threadId,
  //       //     notificationLevel: 0,
  //       //     createdAt: fechaC,
  //       //   },
  //       // });
  //     }
  //   }
  // }

  // private buildMessage(subject) {}
}
