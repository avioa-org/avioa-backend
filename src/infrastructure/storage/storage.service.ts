import { Injectable } from '@nestjs/common';
import { envs } from 'src/config/env.config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = envs.SUPABASE_BUCKET;

  constructor() {
    this.supabase = createClient(envs.SUPABASE_URL, envs.SUPABASE_SECRET_KEY);
  }

  async getPresignedUploadUrl(key: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);

    if (error) throw error;
    return { uploadUrl: data.signedUrl, token: data.token, key: data.path };
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresInSeconds = 600,
    bucket = this.bucket,
  ) {
    const { data, error } = await this.supabase.storage
      .from(bucket)
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

  async downloadFile(key: string, bucket = this.bucket): Promise<Buffer> {
    console.log('bucket', bucket);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(key);

    console.error(data, error);

    if (error) throw error;
    if (!data) throw new Error(`No se pudo descargar ${key}`);

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async uploadFile(
    key: string,
    file: Buffer,
    contentType = 'application/octet-stream',
    bucket = this.bucket,
  ) {
    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(key, file, { contentType, upsert: true });

    if (error) throw error;
    return { key };
  }
}
