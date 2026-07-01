import { Injectable, Logger } from '@nestjs/common';
import { google, Auth } from 'googleapis';
import { envs } from 'src/config/env.config';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import bcrypt from 'bcrypt';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  private createOAuthClient(): Auth.OAuth2Client {
    return new google.auth.OAuth2(
      envs.GOOGLE_CLIENT_ID as string,
      envs.GOOGLE_CLIENT_SECRET as string,
      envs.GOOGLE_REDIRECT_URI as string,
    );
  }

  public async generateAuthUrl(userId: string): Promise<string> {
    this.logger.log(`Generating auth URL for user ${userId}`);
    const oauth2Client = this.createOAuthClient();

    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/calendar',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: userId,
    });
  }

  public async getTokensFromCode(
    code: string,
    userId: string,
  ): Promise<Auth.Credentials> {
    const oauth2Client = this.createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    await this.prisma.googleCredentials.upsert({
      where: { userId },
      update: {
        userId,
        refreshToken: await bcrypt.hash(tokens.refresh_token!, 10),
        accessToken: tokens.access_token!,
        expiryDate: new Date(tokens.expiry_date!),
        driveEnabled: true,
        calendarEnabled: true,
      },
      create: {
        userId,
        refreshToken: await bcrypt.hash(tokens.refresh_token!, 10),
        accessToken: tokens.access_token!,
        expiryDate: new Date(tokens.expiry_date!),
        driveEnabled: true,
        calendarEnabled: true,
      },
    });

    return tokens; // { access_token, refresh_token }
  }

  public async getAuthenticatedClient(
    refreshToken: string,
  ): Promise<Auth.OAuth2Client> {
    const oauth2Client = this.createOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }
}
