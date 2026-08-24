import { InternalServerErrorException } from '@nestjs/common';
import { envs } from 'src/config/env.config';
import * as crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const secret = envs.PASSWORD_MASTER_KEY;

    this.key = Buffer.from(secret, 'hex');

    if (this.key.length !== 32) {
      throw new InternalServerErrorException(
        'PASSWORD_MASTER_KEY debe tener 32 bytes',
      );
    }
  }

  encrypt(value: string) {
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };
  }

  decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(value: string) {
    const pepper = envs.PASSWORD_PEPPER_KEY;
    return crypto
      .createHash('sha256')
      .update(value + pepper)
      .digest('hex');
  }
}
