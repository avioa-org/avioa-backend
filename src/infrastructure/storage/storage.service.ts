import { Injectable } from '@nestjs/common';
import { envs } from 'src/config/env.config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = envs.SUPABASE_BUCKET;

  constructor() {
    this.supabase = createClient(
      envs.SUPABASE_URL,
      envs.SUPABASE_PUBLISHABLE_KEY,
    );
  }

  async getPresignedUploadUrl(key: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);

    if (error) throw error;
    return { uploadUrl: data.signedUrl, token: data.token, key: data.path };
  }

  async getPresignedDownloadUrl(key: string, expiresInSeconds = 600) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresInSeconds);

    if (error) throw error;
    return data.signedUrl;
  }

  async deleteFile(key: string) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);
    if (error) throw error;
  }
}
