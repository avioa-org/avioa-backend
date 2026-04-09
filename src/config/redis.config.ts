import { registerAs } from '@nestjs/config';
import { envs } from './env.config';

export default registerAs('redis', () => ({
  host: envs.REDIS_HOST || 'localhost',
  port: envs.REDIS_PORT || 6379,
  password: undefined,
}));
