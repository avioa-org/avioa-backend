import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { CreateBulkRewardDto, CreateRewardDto } from '../dto/create-reward.dto';
import { v2 as cloudinary } from 'cloudinary';
import { envs } from 'src/config/env.config';

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

  public async createBulkRewards(rewards: CreateBulkRewardDto) {
    // return this.prisma.reward.createMany({ data: rewards.data });

    return 'hola';
  }

  public async getRewards() {
    const rewards = await this.prisma.reward.findMany();
    return { rewards };
  }
}
