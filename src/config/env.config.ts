import 'dotenv/config';

export const envs = {
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT || 6379,
  redisPassword: process.env.REDIS_PASSWORD,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRefreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  databaseUrl: process.env.DATABASE_URL,
  googleCredentials: process.env.GOOGLE_CREDENTIALS ?? '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI,
  internalToken: process.env.INTERNAL_TOKEN,
  openaiApiKey: process.env.OPENAI_API_KEY,
};
