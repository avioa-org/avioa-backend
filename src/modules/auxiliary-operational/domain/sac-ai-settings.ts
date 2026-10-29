import { envs } from '../../../config/env.config';

/** Native configuration: no Sites or Cloudflare settings table is needed. */
export async function readSacAiConfig(_db: unknown, _secret?: string) {
  const apiKey = envs.AUXILIARY_OPENAI_API_KEY || envs.OPENAI_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: envs.AUXILIARY_OPENAI_MODEL || 'gpt-4.1',
    enabled: envs.AUXILIARY_AI_ENABLED === 'true',
    dailyLimit: Math.max(
      1,
      Math.min(1000, Number(envs.AUXILIARY_AI_DAILY_LIMIT) || 100),
    ),
    revision: 1,
  };
}
