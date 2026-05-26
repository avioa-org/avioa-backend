import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { CreateBulkRewardDto, CreateRewardDto } from '../dto/create-reward.dto';
import { v2 as cloudinary } from 'cloudinary';
import { envs } from 'src/config/env.config';
import { MemoryStoredFile } from 'nestjs-form-data';

@Injectable()
export class RewardService {
  private readonly logger = new Logger(RewardService.name);

  constructor(private readonly prisma: PrismaService) {
    cloudinary.config({
      cloud_name: envs.CLOUDINARY_CLOUD_NAME,
      api_key: envs.CLOUDINARY_API_KEY,
      api_secret: envs.CLOUDINARY_API_SECRET,
    });
  }

  public async createReward(createRewardDto: CreateRewardDto) {
    return this.prisma.reward.create({ data: createRewardDto });
  }

  public async createBulkRewards(
    rewards: CreateRewardDto[],
    files: MemoryStoredFile[],
  ) {
    let fileIndex = 0;

    const mapRewards = rewards.map((reward, index) => {
      if (reward.imageUrl) {
        return { ...reward };
      }

      const file = files[fileIndex];
      if (file) fileIndex++;

      return {
        ...reward,
        ...(file ? { buffer: file.buffer } : {}),
      };
    });

    const uploadedPublicIds: string[] = []; // para rollback manual

    const rewardsWithUrls = await Promise.all(
      mapRewards.map(async (reward) => {
        if (!reward.buffer) return reward;

        const { secure_url, public_id } = await this.uploadBufferToCloudinary(
          reward.buffer,
        );

        uploadedPublicIds.push(public_id);

        const { buffer, ...rest } = reward;
        return { ...rest, imageUrl: secure_url };
      }),
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        return await tx.reward.createMany({
          data: rewardsWithUrls,
        });
      });
    } catch (error) {
      if (uploadedPublicIds.length > 0) {
        await cloudinary.api.delete_resources(uploadedPublicIds);
      }

      throw error;
    }
  }

  public async getRewards() {
    const rewards = await this.prisma.reward.findMany();
    return { rewards };
  }

  public async deleteReward(rewardId: string) {
    const reward = await this.prisma.reward.findUnique({ where: { rewardId } });

    if (!reward) {
      throw new NotFoundException({
        message: `La recompensa con el id: ${rewardId} no existe`,
        error: 'REWARD_NOT_FOUND',
      });
    }

    if (reward.imageUrl?.includes('https://res.cloudinary.com')) {
      const publicId = reward.imageUrl.split('/').pop()?.split('.')[0] ?? null;
      if (publicId) await cloudinary.api.delete_resources([publicId]);
    }

    this.logger.log(`Eliminando recompensa con id: ${rewardId}`);

    return await this.prisma.reward.delete({ where: { rewardId } });
  }

  private uploadBufferToCloudinary(
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
}
