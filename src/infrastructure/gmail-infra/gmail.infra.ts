// import { authenticate } from '@google-cloud/local-auth';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { envs } from 'src/config/env.config';

@Injectable()
export class GmailInfraService {
  private readonly gmail: ReturnType<typeof google.gmail>;

  constructor(private config: ConfigService) {
    this.gmail = this.createClient();
  }

  private createClient() {
    const clientId = envs.GOOGLE_CLIENT_ID;
    const clientSecret = envs.GOOGLE_CLIENT_SECRET;
    const refreshToken = envs.GOOGLE_REFRESH_TOKEN;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  public getClient() {
    return this.gmail;
  }
}
