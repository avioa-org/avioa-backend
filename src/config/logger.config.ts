import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { isProd } from './env.config';
import { requestContextStorage } from '../common/context/request-context.store';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'secret',
  'creditcard',
  '2fasecret',
  'otp',
  'newpassword',
  'oldpassword',
  'jwt',
  'refreshtoken',
  'accesstoken',
]);

export function sanitizeMetadata(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (data instanceof Date || data instanceof RegExp) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeMetadata(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const addRequestContext = winston.format((info) => {
  const store = requestContextStorage.getStore();
  if (store) {
    if (store.requestId && !info.requestId) info.requestId = store.requestId;
    if (store.userId && !info.userId) info.userId = store.userId;
    if (store.userEmail && !info.userEmail) info.userEmail = store.userEmail;
  }
  return info;
});

const sanitizeFormat = winston.format((info) => {
  return sanitizeMetadata(info) as winston.Logform.TransformableInfo;
});

const logLevel = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  addRequestContext(),
  sanitizeFormat(),
  isProd
    ? winston.format.json()
    : nestWinstonModuleUtilities.format.nestLike('Avioa', {
        colors: true,
        prettyPrint: true,
        processId: true,
      }),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  addRequestContext(),
  sanitizeFormat(),
  winston.format.json(),
);

export const loggerConfig = WinstonModule.createLogger({
  level: logLevel,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      format: fileFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: logLevel,
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      format: fileFormat,
    }),
  ],
});
