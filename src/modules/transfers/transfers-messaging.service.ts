import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { google } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import { envs } from '../../config/env.config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { GoogleService } from '../google/google.service';
import { GmailService } from '../google/gmail/gmail.service';
import { z } from 'zod';

const MessageDataSchema = z.object({
  holder: z.string(),
  phone: z.string(),
  advisor: z.string(),
  reservation: z.string(),
  destination: z.string(),
  hotel: z.string(),
  passengers: z.coerce.number(),
  infants: z.coerce.number(),
  arrivalAirline: z.string(),
  arrivalFlight: z.string(),
  arrivalDate: z.string(),
  arrivalTime: z.string(),
  returnAirline: z.string(),
  returnFlight: z.string(),
  returnDate: z.string(),
  returnTime: z.string(),
  includesTours: z.boolean(),
  tourNotes: z.string().optional(),
  notes: z.string().optional(),
});

type MessageData = z.infer<typeof MessageDataSchema>;

function parseMessageData(input: unknown): MessageData {
  const result = MessageDataSchema.safeParse(input);

  if (!result.success) {
    throw new Error(
      `Payload de TransferRequest inválido: ${result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
    );
  }

  return result.data;
}

const scope = 'https://www.googleapis.com/auth/gmail.send';
const destinations: Record<string, string> = {
  Cartagena: 'CARTAGENA',
  'Santa Marta': 'SANTA_MARTA',
  'San Andrés': 'SAN_ANDRES',
  Palomino: 'PALOMINO',
  Barú: 'BARU',
};
const digest = (value: string) =>
  createHash('sha256').update(value).digest('base64url');
const callback = () =>
  new URL(
    '/api/v1/transfers/gmail/callback',
    new URL(envs.GOOGLE_REDIRECT_URI).origin,
  ).toString();
function encrypt(value: string) {
  const key = Buffer.from(envs.PASSWORD_MASTER_KEY, 'hex');
  if (key.length !== 32) throw new Error('Clave de cifrado no válida');
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    value: data.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}
function decrypt(value: string, iv: string, tag: string) {
  const key = Buffer.from(envs.PASSWORD_MASTER_KEY, 'hex'),
    decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(value, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
function message(v: MessageData) {
  return (
    'Cordial saludo.\nDesde la agencia de viajes aVioa solicitamos su apoyo con la gestión del siguiente servicio de traslado.\n\n' +
    'Titular de la reserva: ' +
    v.holder +
    '\nTeléfono: ' +
    v.phone +
    '\nAsesor: ' +
    v.advisor +
    '\nNúmero de reserva iTraffic: ' +
    v.reservation +
    '\nDestino: ' +
    v.destination +
    '\nHotel: ' +
    v.hotel +
    '\nPasajeros mayores de 2 años: ' +
    v.passengers +
    '\nInfantes de 0 a 2 años: ' +
    v.infants +
    '\n\nLLEGADA\nAerolínea: ' +
    v.arrivalAirline +
    '\nVuelo: ' +
    v.arrivalFlight +
    '\nFecha: ' +
    v.arrivalDate +
    '\nHora local del destino: ' +
    v.arrivalTime +
    '\n\nREGRESO\nAerolínea: ' +
    v.returnAirline +
    '\nVuelo: ' +
    v.returnFlight +
    '\nFecha: ' +
    v.returnDate +
    '\nHora local del destino: ' +
    v.returnTime +
    '\n\nIncluye tours: ' +
    (v.includesTours ? 'Sí' : 'No') +
    (v.includesTours ? '\nTours: ' + v.tourNotes : '') +
    (v.notes ? '\nObservaciones: ' + v.notes : '') +
    '\n\nEstaremos atentos a su respuesta. Muchas gracias.'
  );
}
function emailList(contact: string) {
  const list = contact
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!list.length || list.some((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))
    throw new BadRequestException('Revisa los correos del proveedor.');
  return list;
}
function phone(contact: string) {
  const number = contact.trim().replace(/^\+/, '');
  if (!/^[1-9]\d{9,14}$/.test(number))
    throw new BadRequestException(
      'El proveedor necesita un WhatsApp internacional válido.',
    );
  return number;
}
@Injectable()
export class TransfersMessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleService: GoogleService,
    private readonly gmailService: GmailService,
  ) {}

  private oauth() {
    return this.googleService.createOAuthClient(callback());
  }

  async gmailStatus(userId: string) {
    const row = await this.prisma.transferGmailConnection.findUnique({
      where: { userId },
    });
    return {
      configured: true,
      connected: row?.status === 'CONNECTED',
      email: row?.email ?? null,
      needsReconnect: row?.status === 'REAUTHORIZE',
    };
  }
  async startGmail(userId: string, returnTo = '/transfers') {
    const destination = returnTo === '/profile' ? '/profile' : '/transfers';
    const state = randomBytes(32).toString('base64url'),
      verifier = randomBytes(48).toString('base64url');
    const authorizationUrl = this.oauth().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent select_account',
      scope: [scope, 'openid', 'email'],
      state,
      code_challenge: digest(verifier),
      code_challenge_method: CodeChallengeMethod.S256,
    });
    await this.prisma.transferGmailOAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await this.prisma.transferGmailOAuthState.create({
      data: {
        stateHash: digest(state),
        userId,
        verifier,
        returnTo: destination,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    return { authorizationUrl };
  }
  async finishGmail(state: string, code: string) {
    if (!state || !code)
      throw new BadRequestException('Respuesta OAuth incompleta.');
    const stateHash = digest(state),
      saved = await this.prisma.transferGmailOAuthState.findUnique({
        where: { stateHash },
      });
    if (!saved || saved.expiresAt.getTime() < Date.now())
      throw new BadRequestException('La autorización venció.');
    if (
      !(
        await this.prisma.transferGmailOAuthState.deleteMany({
          where: { stateHash },
        })
      ).count
    )
      throw new BadRequestException('La autorización ya fue utilizada.');
    const auth = this.oauth(),
      result = await auth.getToken({ code, codeVerifier: saved.verifier });
    if (
      !result.tokens.access_token ||
      !(result.tokens.scope || '').split(' ').includes(scope)
    )
      throw new BadRequestException('Google no concedió permiso de envío.');
    auth.setCredentials(result.tokens);
    const profile = await google.oauth2({ version: 'v2', auth }).userinfo.get(),
      email = profile.data.email;
    if (!email || profile.data.verified_email !== true)
      throw new BadRequestException('No se pudo verificar el correo.');
    const previous = await this.prisma.transferGmailConnection.findUnique({
      where: { userId: saved.userId },
    });
    const refresh =
      result.tokens.refresh_token ??
      (previous?.email === email
        ? decrypt(
            previous.encryptedRefreshToken,
            previous.refreshTokenIv,
            previous.refreshTokenTag,
          )
        : null);
    if (!refresh)
      throw new BadRequestException(
        'Google no devolvió acceso persistente. Vuelve a autorizar Gmail.',
      );
    const token = encrypt(refresh);
    await this.prisma.transferGmailConnection.upsert({
      where: { userId: saved.userId },
      create: {
        userId: saved.userId,
        email,
        encryptedRefreshToken: token.value,
        refreshTokenIv: token.iv,
        refreshTokenTag: token.tag,
        status: 'CONNECTED',
      },
      update: {
        email,
        encryptedRefreshToken: token.value,
        refreshTokenIv: token.iv,
        refreshTokenTag: token.tag,
        status: 'CONNECTED',
      },
    });
    return { returnTo: saved.returnTo };
  }
  async gmailReturnTo(state: string) {
    if (!state) return '/transfers';
    const saved = await this.prisma.transferGmailOAuthState.findUnique({
      where: { stateHash: digest(state) },
    });
    return saved?.returnTo === '/profile' ? '/profile' : '/transfers';
  }
  async cancelGmail(state: string) {
    if (state)
      await this.prisma.transferGmailOAuthState.deleteMany({
        where: { stateHash: digest(state) },
      });
  }
  async disconnectGmail(userId: string) {
    await this.prisma.transferGmailOAuthState.deleteMany({ where: { userId } });
    await this.prisma.transferGmailConnection.deleteMany({ where: { userId } });
    return { disconnected: true };
  }
  async evolutionStatus() {
    try {
      const response = await fetch(
        envs.EVOLUTION_URL.replace(/\/+$/, '') +
          '/instance/connectionState/' +
          encodeURIComponent(envs.EVOLUTION_INSTANCE),
        {
          headers: { apikey: envs.EVOLUTION_API_KEY },
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        return {
          configured: true,
          connected: false,
          instance: envs.EVOLUTION_INSTANCE,
          state: 'error',
          message:
            'Evolution API rechazó la consulta (HTTP ' + response.status + ').',
        };
      const body = (await response.json()) as { instance?: { state?: string } },
        state = body.instance?.state || 'unknown';
      return {
        configured: true,
        connected: state === 'open',
        instance: envs.EVOLUTION_INSTANCE,
        state,
        message:
          state === 'open'
            ? 'La instancia de WhatsApp está conectada.'
            : 'La instancia de WhatsApp no está conectada.',
      };
    } catch {
      return {
        configured: true,
        connected: false,
        instance: envs.EVOLUTION_INSTANCE,
        state: 'unreachable',
        message: 'No se pudo consultar Evolution API.',
      };
    }
  }
  private async owned(userId: string, id: string) {
    const row = await this.prisma.transferRequest.findFirst({
      where: { transferRequestId: id, userId },
    });
    if (!row) throw new NotFoundException('Solicitud no encontrada.');
    return { ...row, payload: parseMessageData(row.payload) };
  }
  private provider(row: { payload: Record<string, unknown> }) {
    const destination = destinations[String(row.payload.destination)];

    return destination
      ? this.prisma.transferProvider.findFirst({
          where: { destination: destination as never, isActive: true },
        })
      : null;
  }

  async emailPreview(userId: string, id: string) {
    const transfer = await this.owned(userId, id),
      provider = await this.provider(transfer);

    const connection = await this.prisma.transferGmailConnection.findUnique({
      where: { userId },
    });

    const to = provider?.channel === 'EMAIL' ? emailList(provider.contact) : [];

    const from = connection?.email ?? null,
      subject =
        'SOLICITUD Y ASIGNACIÓN DE TRASLADOS · ' +
        String(transfer.payload.reservation).replace(/[\r\n]/g, ' ');

    const text = message(transfer.payload),
      previewHash = digest(
        JSON.stringify({ version: transfer.version, to, from, subject, text }),
      );

    const deliveries = await this.prisma.transferEmailDelivery.findMany({
      where: { transferRequestId: id },
      orderBy: { createdAt: 'desc' },
    });

    const reason =
      provider?.channel !== 'EMAIL'
        ? 'Este destino utiliza WhatsApp.'
        : transfer.status === 'CANCELLED'
          ? 'La solicitud está cancelada.'
          : connection?.status !== 'CONNECTED'
            ? 'Conecta una cuenta de Gmail.'
            : null;

    return {
      version: transfer.version,
      previewHash,
      to,
      from,
      subject,
      text,
      canSend: !reason,
      reason,
      deliveries,
    };
  }

  async sendEmail(
    userId: string,
    id: string,
    input: { version: number; previewHash: string; retry?: boolean },
  ) {
    const preview = await this.emailPreview(userId, id);

    if (
      !preview.canSend ||
      preview.version !== input.version ||
      preview.previewHash !== input.previewHash
    )
      throw new ConflictException(
        preview.reason ?? 'Revisa de nuevo el mensaje.',
      );

    const where = {
      transferRequestId_version: {
        transferRequestId: id,
        version: preview.version,
      },
    };

    const old = await this.prisma.transferEmailDelivery.findUnique({ where });

    if (old?.status === 'SENT') return { delivery: old, alreadySent: true };

    if (old && (old.status !== 'FAILED' || !input.retry))
      throw new ConflictException(
        old.status === 'UNCERTAIN'
          ? 'Resultado incierto. Comprueba Gmail Enviados.'
          : 'El envío ya está en curso o requiere un reintento explícito.',
      );

    try {
      if (old) {
        const claimed = await this.prisma.transferEmailDelivery.updateMany({
          where: {
            transferRequestId: id,
            version: preview.version,
            status: 'FAILED',
            attempt: old.attempt,
          },
          data: { status: 'SENDING', attempt: { increment: 1 }, error: null },
        });

        if (claimed.count !== 1)
          throw new ConflictException('Este envío ya está siendo procesado.');
      } else
        await this.prisma.transferEmailDelivery.create({
          data: {
            transferRequestId: id,
            version: preview.version,
            previewHash: preview.previewHash,
            sender: preview.from!,
            recipients: preview.to.join(','),
            status: 'SENDING',
          },
        });
    } catch {
      throw new ConflictException('Este envío ya está siendo procesado.');
    }
    const record = async (
      status: string,
      error: string | null,
      messageId: string | null = null,
    ) =>
      this.prisma.$transaction(async (tx) => {
        const delivery = await tx.transferEmailDelivery.update({
          where,
          data: { status, error, providerMessageId: messageId },
        });

        await tx.transferRequestEvent.create({
          data: {
            transferRequestId: id,
            action:
              status === 'SENT'
                ? 'Correo enviado mediante Gmail · versión ' + preview.version
                : status === 'UNCERTAIN'
                  ? 'Correo con resultado incierto · revisar Enviados'
                  : 'Intento de correo fallido',
          },
        });

        return delivery;
      });

    const connection = await this.prisma.transferGmailConnection.findUnique({
      where: { userId },
    });

    if (!connection || connection.email !== preview.from)
      return {
        delivery: await record(
          'FAILED',
          'La cuenta remitente cambió. Revisa el mensaje.',
        ),
        alreadySent: false,
      };

    try {
      const auth = this.oauth();

      auth.setCredentials({
        refresh_token: decrypt(
          connection.encryptedRefreshToken,
          connection.refreshTokenIv,
          connection.refreshTokenTag,
        ),
      });

      const sent = await this.gmailService.sendMessage(
        auth,
        preview.to,
        preview.subject,
        preview.text,
      );

      if (!sent.data.id)
        return {
          delivery: await record(
            'UNCERTAIN',
            'Gmail no devolvió identificador. Revisa Enviados.',
          ),
          alreadySent: false,
        };

      return {
        delivery: await record('SENT', null, sent.data.id),
        alreadySent: false,
      };
    } catch (error) {
      const gmailError = error as {
          response?: {
            status?: number;
            data?: {
              error?: {
                message?: string;
                errors?: Array<{ reason?: string }>;
              };
            };
          };
        },
        status = Number(gmailError.response?.status),
        reason = gmailError.response?.data?.error?.errors?.[0]?.reason,
        rejected = status >= 400 && status < 500;

      let errorMessage =
        'No se pudo confirmar. Revisa Enviados antes de reenviar.';

      if (rejected) {
        errorMessage =
          'Gmail rechaz� el env�o (HTTP ' + (status || 'desconocido') + ').';
        if (
          status === 401 ||
          reason === 'insufficientPermissions' ||
          (status === 403 && !reason)
        ) {
          await this.prisma.transferGmailConnection.updateMany({
            where: { userId },
            data: { status: 'REAUTHORIZE' },
          });

          errorMessage =
            'La conexión de Gmail necesita renovarse para enviar. Vuelve a conectar Gmail y acepta el permiso de envío.';
        } else if (reason === 'accessNotConfigured') {
          errorMessage =
            'La Gmail API no está habilitada en el proyecto de Google Cloud. Habilita Gmail API para esta aplicación.';
        } else if (reason === 'domainPolicy') {
          errorMessage =
            'La política de Google Workspace bloquea el envío desde esta aplicación. Solicita habilitar Gmail API al administrador.';
        } else if (reason) {
          errorMessage += ' Motivo de Google: ' + reason + '.';
        } else if (gmailError.response?.data?.error?.message) {
          errorMessage +=
            ' Respuesta de Google: ' + gmailError.response.data.error.message;
        }
      }
      return {
        delivery: await record(rejected ? 'FAILED' : 'UNCERTAIN', errorMessage),
        alreadySent: false,
      };
    }
  }
  async whatsappPreview(userId: string, id: string) {
    const transfer = await this.owned(userId, id),
      provider = await this.provider(transfer),
      health = await this.evolutionStatus();
    const number =
        provider?.channel === 'WHATSAPP' ? phone(provider.contact) : null,
      text = message(transfer.payload);
    const previewHash = digest(
      JSON.stringify({
        version: transfer.version,
        number,
        text,
        instance: health.instance,
        origin: envs.EVOLUTION_URL,
      }),
    );
    const deliveries = await this.prisma.transferWhatsAppDelivery.findMany({
      where: { transferRequestId: id },
      orderBy: { createdAt: 'desc' },
    });
    const reason =
      provider?.channel !== 'WHATSAPP'
        ? 'Este destino utiliza correo electrónico.'
        : transfer.status === 'CANCELLED'
          ? 'La solicitud está cancelada.'
          : !health.connected
            ? health.message
            : null;
    return {
      version: transfer.version,
      previewHash,
      number,
      instance: health.instance,
      text,
      canSend: !reason,
      reason,
      deliveries,
    };
  }
  async sendWhatsApp(
    userId: string,
    id: string,
    input: { version: number; previewHash: string; retry?: boolean },
  ) {
    const preview = await this.whatsappPreview(userId, id);

    if (
      !preview.canSend ||
      !preview.number ||
      preview.version !== input.version ||
      preview.previewHash !== input.previewHash
    )
      throw new ConflictException(
        preview.reason ?? 'Revisa de nuevo el mensaje.',
      );

    const where = {
      transferRequestId_version: {
        transferRequestId: id,
        version: preview.version,
      },
    };

    const old = await this.prisma.transferWhatsAppDelivery.findUnique({
      where,
    });

    if (old?.status === 'ACCEPTED') return { delivery: old, alreadySent: true };

    if (old && (old.status !== 'FAILED' || !input.retry))
      throw new ConflictException(
        old.status === 'UNCERTAIN'
          ? 'Resultado incierto. Comprueba WhatsApp antes de reenviar.'
          : 'El envío ya está en curso o requiere un reintento explícito.',
      );
    try {
      if (old) {
        const claimed = await this.prisma.transferWhatsAppDelivery.updateMany({
          where: {
            transferRequestId: id,
            version: preview.version,
            status: 'FAILED',
            attempt: old.attempt,
          },
          data: { status: 'SENDING', attempt: { increment: 1 }, error: null },
        });
        if (claimed.count !== 1)
          throw new ConflictException('Este envío ya está siendo procesado.');
      } else
        await this.prisma.transferWhatsAppDelivery.create({
          data: {
            transferRequestId: id,
            version: preview.version,
            previewHash: preview.previewHash,
            instance: String(preview.instance),
            number: preview.number,
            status: 'SENDING',
          },
        });
    } catch {
      throw new ConflictException('Este envío ya está siendo procesado.');
    }
    const record = async (
      status: string,
      error: string | null,
      messageId: string | null = null,
    ) =>
      this.prisma.$transaction(async (tx) => {
        const delivery = await tx.transferWhatsAppDelivery.update({
          where,
          data: { status, error, providerMessageId: messageId },
        });
        await tx.transferRequestEvent.create({
          data: {
            transferRequestId: id,
            action:
              status === 'ACCEPTED'
                ? 'WhatsApp aceptado por Evolution · versión ' + preview.version
                : status === 'UNCERTAIN'
                  ? 'WhatsApp con resultado incierto · verificar antes de reenviar'
                  : 'Intento de WhatsApp rechazado',
          },
        });
        return delivery;
      });
    try {
      const response = await fetch(
        envs.EVOLUTION_URL.replace(/\/+$/, '') +
          '/message/sendText/' +
          encodeURIComponent(String(preview.instance)),
        {
          method: 'POST',
          headers: {
            apikey: envs.EVOLUTION_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ number: preview.number, text: preview.text }),
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        },
      );

      if (!response.ok) {
        const rejected = response.status >= 400 && response.status < 500;
        return {
          delivery: await record(
            rejected ? 'FAILED' : 'UNCERTAIN',
            rejected
              ? 'Evolution rechazó el mensaje (HTTP ' + response.status + ').'
              : 'Evolution devolvió un error. Comprueba WhatsApp.',
          ),
          alreadySent: false,
        };
      }

      const result = (await response.json()) as { key?: { id?: string } };

      if (!result.key?.id)
        return {
          delivery: await record(
            'UNCERTAIN',
            'Evolution no devolvió identificador. Comprueba WhatsApp.',
          ),
          alreadySent: false,
        };

      return {
        delivery: await record('ACCEPTED', null, result.key.id),
        alreadySent: false,
      };
    } catch {
      return {
        delivery: await record(
          'UNCERTAIN',
          'No se pudo confirmar. Comprueba WhatsApp antes de reenviar.',
        ),
        alreadySent: false,
      };
    }
  }
}
