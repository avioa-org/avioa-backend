import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { envs } from 'src/config/env.config';
import { GmailService } from './gmail/gmail.service';

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);

  constructor(private readonly gmailService: GmailService) {}

  createOAuthClient(redirectUri = envs.GOOGLE_REDIRECT_URI) {
    return new google.auth.OAuth2(
      envs.GOOGLE_CLIENT_ID,
      envs.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );
  }

  private async getAuthClient() {
    return this.createOAuthClient();
  }

  async getGoogleAuthUrl() {
    const authClient = await this.getAuthClient();

    const url = authClient.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    });

    return url;
  }

  async getToken(code: string) {
    const authClient = await this.getAuthClient();
    const { tokens } = await authClient.getToken(code);
    return tokens;
  }

  async getSubjects() {
    return await this.gmailService.getHotelsWithInmediatePayments();
  }
}
