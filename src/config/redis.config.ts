import { registerAs } from '@nestjs/config';
import { envs } from './env.config';

export default registerAs('redis', () => ({
  host: envs.redisHost || 'localhost',
  port: envs.redisPort || 6379,
  password: envs.redisPassword || undefined,
}));
