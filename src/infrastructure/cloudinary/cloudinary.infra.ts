import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { envs } from 'src/config/env.config';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: envs.CLOUDINARY_CLOUD_NAME,
      api_key: envs.CLOUDINARY_API_KEY,
      api_secret: envs.CLOUDINARY_API_SECRET,
    });
  }

  public uploadBufferToCloudinary(
    buffer: Buffer,
  ): Promise<{ secure_url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: 'rewards' }, (error, result) => {
          if (error || !result) return reject(error as Error);
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        })
        .end(buffer);
    });
  }

  public async deleteImage(publicId: string) {
    return await cloudinary.api.delete_resources([publicId]);
  }
}
