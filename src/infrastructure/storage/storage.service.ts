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

    let url = data.signedUrl;

    if (url.startsWith('/')) {
      const baseUrl = envs.SUPABASE_URL.replace(/\/$/, '');
      url = `${baseUrl}/storage/v1${url}`;
    }

    return url;
  }

  async getPresignedDownloadUrls(keys: string[], expiresInSeconds = 3600) {
    if (keys.length === 0) return {};

    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrls(keys, expiresInSeconds);

    if (error) throw error;

    const baseUrl = envs.SUPABASE_URL.replace(/\/$/, '');

    return Object.fromEntries(
      data.map((d) => {
        let finalUrl = d.signedUrl;

        // Si la URL viene relativa, la hacemos absoluta
        if ((finalUrl as string).startsWith('/')) {
          finalUrl = `${baseUrl}/storage/v1${finalUrl}`;
        }

        return [d.path, finalUrl];
      }),
    );
  }

  async deleteFile(key: string) {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);
    if (error) throw error;
  }

  async downloadFile(key: string, bucket = this.bucket): Promise<Buffer> {
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .download(key);

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
