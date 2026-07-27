import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';

const isBuild = process.env.SKIP_ENV_VALIDATION === 'true';

if (!isBuild) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envFile = `.env.${nodeEnv}`;

  dotenv.config({
    path: path.resolve(process.cwd(), envFile),
  });
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  OPENAI_API_KEY: z.string().min(1),
  INTERNAL_TOKEN: z.string().min(10),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().min(1),
  EVOLUTION_URL: z.string().url(),
  EVOLUTION_INSTANCE: z.string().min(1),
  EVOLUTION_API_KEY: z.string().min(10),
  EVOLUTION_NUMERO_DESTINO: z.string().min(12),
  EVOLUTION_CORREO_ALERTA: z.string().email(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('30m'),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().min(1),
  FRONTEND_URL: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
});

let envs: z.infer<typeof envSchema>;

if (isBuild) {
  envs = process.env as unknown as z.infer<typeof envSchema>;
} else {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      `❌ Variables de entorno inválidas:\n${parsed.error.message}`,
    );
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  envs = parsed.data;
}

export { envs };
export const isDev = envs.NODE_ENV === 'development';
export const isProd = envs.NODE_ENV === 'production';
